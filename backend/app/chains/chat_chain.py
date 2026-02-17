"""
LangChain chat chain with Claude + tool calling.
Handles conversation management, tool execution, and streaming.

Implements the Vercel AI SDK v6 **UI Message Stream Protocol**:
  - Standard SSE: `data: {json}\n\n`
  - Header: `x-vercel-ai-ui-message-stream: v1`
  - Events: start, start-step, text-start, text-delta, text-end,
            tool-input-available, tool-output-available, finish-step, finish, [DONE]
"""

import os
import json
import uuid
import logging
from typing import AsyncGenerator, Union

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import (
    HumanMessage,
    AIMessage,
    SystemMessage,
    ToolMessage,
)

from app.chains.prompts import get_system_prompt, SYSTEM_PROMPT_VERSION
from app.tools.search_tools import get_tools

logger = logging.getLogger(__name__)

# ─── Constants ───
MAX_TOOL_STEPS = 5
MAX_ESTIMATED_TOKENS = 80000
CHARS_PER_TOKEN = 4


def _create_llm() -> ChatAnthropic:
    """Create the Claude LLM instance with tool binding."""
    return ChatAnthropic(
        model="claude-sonnet-4-20250514",
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
        max_tokens=4096,
        streaming=True,
    )


def _estimate_tokens(messages: list) -> int:
    """Rough token estimation: ~4 chars per token."""
    return len(json.dumps([str(m) for m in messages])) // CHARS_PER_TOKEN


def _trim_conversation(messages: list) -> list:
    """Trim conversation if too long, preserving first and last messages."""
    estimated = _estimate_tokens(messages)
    if estimated <= MAX_ESTIMATED_TOKENS:
        return messages

    logger.warning(f"Trimming conversation: {len(messages)} messages, ~{estimated} tokens")
    keep_last = max(10, int(len(messages) * 0.6))
    return [messages[0]] + messages[-keep_last:]


def _convert_frontend_messages(messages: list[dict]) -> list:
    """
    Convert frontend message format (role + content) to LangChain message objects.
    """
    lc_messages = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")

        # Handle Vercel AI SDK v6 parts-based format
        if "parts" in msg and isinstance(msg["parts"], list):
            text_parts = []
            for part in msg["parts"]:
                if isinstance(part, dict) and part.get("type") == "text":
                    text_parts.append(part.get("text", ""))
                elif isinstance(part, str):
                    text_parts.append(part)
            content = "\n".join(text_parts) if text_parts else content

        if role == "user":
            lc_messages.append(HumanMessage(content=content))
        elif role == "assistant":
            lc_messages.append(AIMessage(content=content))

    return lc_messages



def _sse_event(data: Union[dict, str]) -> str:
    """Format a single SSE event: `data: {json}\n\n`."""
    if isinstance(data, str):
        return f"data: {data}\n\n"
    return f"data: {json.dumps(data, default=str)}\n\n"


def _extract_text(content) -> str:
    """Extract plain text from LangChain message content.
    
    ChatAnthropic can return content as:
      - str: plain text
      - list: [{"text": "Hello", "type": "text", "index": 0}, ...]
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
            elif isinstance(block, str):
                parts.append(block)
        return "".join(parts)
    return str(content) if content else ""


async def chat_stream(messages: list[dict]) -> AsyncGenerator[str, None]:
    """
    Process a chat request and yield SSE events using the
    Vercel AI SDK v6 UI Message Stream Protocol.

    Protocol flow:
      1. start → start-step
      2. For tool-calling steps:
         text-start/delta/end (if AI says something before tool call)
         tool-input-available → tool-output-available
         finish-step → start-step (next step)
      3. For the final text step:
         text-start → text-delta (many) → text-end
         finish-step
      4. finish → [DONE]
    """
    llm = _create_llm()
    tools = get_tools()
    llm_with_tools = llm.bind_tools(tools)

    # Build tool lookup
    tool_map = {t.name: t for t in tools}

    # Convert frontend messages to LangChain format
    lc_messages = _convert_frontend_messages(messages)
    lc_messages = _trim_conversation(lc_messages)

    # Prepend system message
    system_msg = SystemMessage(content=get_system_prompt())
    all_messages = [system_msg] + lc_messages

    system_tokens = _estimate_tokens([system_msg])
    user_tokens = _estimate_tokens(lc_messages)
    total_input_tokens = system_tokens + user_tokens
    logger.info(
        f"Chat request: {len(lc_messages)} msgs | "
        f"System prompt: ~{system_tokens} tokens | "
        f"User conversation: ~{user_tokens} tokens | "
        f"Total input: ~{total_input_tokens} tokens | "
        f"prompt={SYSTEM_PROMPT_VERSION}"
    )

    # ─── Emit stream start ───
    msg_id = f"msg-{uuid.uuid4().hex[:12]}"
    yield _sse_event({"type": "start", "messageId": msg_id})

    text_part_index = 0  # incrementing ID for text parts

    # ─── Tool-calling loop ───
    step = 0
    final_text = None  # Will hold non-streamed final text if obtained via ainvoke
    while step < MAX_TOOL_STEPS:
        step += 1
        yield _sse_event({"type": "start-step"})

        # For the first step after tool results, try streaming directly
        # For other steps (tool-calling), use ainvoke to get the full response
        response = await llm_with_tools.ainvoke(all_messages)

        # Log token usage from the response metadata (Anthropic returns actual token counts)
        usage = getattr(response, 'usage_metadata', None) or getattr(response, 'response_metadata', {}).get('usage', {})
        if usage:
            logger.info(f"Step {step} token usage: {usage}")

        # Check if Claude wants to call tools
        if response.tool_calls:
            logger.info(f"Step {step}: {len(response.tool_calls)} tool call(s)")

            # If Claude also produced text before tool calls, stream it
            text = _extract_text(response.content)
            if text.strip():
                tid = f"text-{text_part_index}"
                text_part_index += 1
                yield _sse_event({"type": "text-start", "id": tid})
                yield _sse_event({"type": "text-delta", "id": tid, "delta": text})
                yield _sse_event({"type": "text-end", "id": tid})

            # Add the AI message with tool calls to history
            all_messages.append(response)

            # Execute each tool call and emit tool events
            for tc in response.tool_calls:
                tool_name = tc["name"]
                tool_args = tc["args"]
                tool_id = tc["id"]

                logger.info(f"  Executing tool: {tool_name}({json.dumps(tool_args, default=str)[:200]})")

                # Emit tool-input-available
                yield _sse_event({
                    "type": "tool-input-available",
                    "toolCallId": tool_id,
                    "toolName": tool_name,
                    "input": tool_args,
                })

                # Execute the tool
                if tool_name in tool_map:
                    try:
                        result = await tool_map[tool_name].ainvoke(tool_args)
                        if isinstance(result, (dict, list)):
                            tool_output = result
                            result_str = json.dumps(result, default=str)
                        else:
                            tool_output = {"result": str(result)}
                            result_str = str(result)
                    except Exception as e:
                        logger.error(f"  Tool error: {e}")
                        tool_output = {
                            "success": False,
                            "message": f"Tool execution failed: {str(e)}",
                            "products": [],
                        }
                        result_str = json.dumps(tool_output)
                else:
                    tool_output = {
                        "success": False,
                        "message": f"Unknown tool: {tool_name}",
                        "products": [],
                    }
                    result_str = json.dumps(tool_output)

                # Emit tool-output-available (this is what the frontend reads for ProductCards)
                yield _sse_event({
                    "type": "tool-output-available",
                    "toolCallId": tool_id,
                    "output": tool_output,
                })

                all_messages.append(ToolMessage(
                    content=result_str,
                    tool_call_id=tool_id,
                ))

            yield _sse_event({"type": "finish-step"})

            # Continue the loop — Claude will process tool results
            continue

        # No tool calls — Claude produced a final text response via ainvoke.
        # Use this text directly instead of making a redundant astream() call.
        final_text = _extract_text(response.content)
        logger.info(f"Step {step}: Final response obtained ({len(final_text)} chars)")
        break

    # ─── Emit the final text response ───
    # If we got text from ainvoke (most common after tool calls), emit it directly.
    # Otherwise (no tool calls on first try), stream it fresh.
    if final_text is not None and final_text.strip():
        # Emit the pre-obtained text as delta events
        tid = f"text-{text_part_index}"
        yield _sse_event({"type": "text-start", "id": tid})
        # Split into chunks for smoother frontend rendering
        chunk_size = 20
        for i in range(0, len(final_text), chunk_size):
            yield _sse_event({"type": "text-delta", "id": tid, "delta": final_text[i:i + chunk_size]})
        yield _sse_event({"type": "text-end", "id": tid})
        yield _sse_event({"type": "finish-step"})
    elif final_text is not None:
        # Empty response from ainvoke — stream fresh
        yield _sse_event({"type": "start-step"})
        tid = f"text-{text_part_index}"
        yield _sse_event({"type": "text-start", "id": tid})
        async for chunk in llm_with_tools.astream(all_messages):
            text = _extract_text(chunk.content)
            if text:
                yield _sse_event({"type": "text-delta", "id": tid, "delta": text})
        yield _sse_event({"type": "text-end", "id": tid})
        yield _sse_event({"type": "finish-step"})
    else:
        # No response at all (max tool steps exceeded) — emit empty step
        yield _sse_event({"type": "start-step"})
        tid = f"text-{text_part_index}"
        yield _sse_event({"type": "text-start", "id": tid})
        yield _sse_event({"type": "text-delta", "id": tid, "delta": "I'm sorry, I wasn't able to complete my search. Could you try rephrasing your request?"})
        yield _sse_event({"type": "text-end", "id": tid})
        yield _sse_event({"type": "finish-step"})

    # ─── Finish ───
    yield _sse_event({"type": "finish", "finishReason": "stop"})
    yield "data: [DONE]\n\n"


async def chat_non_streaming(messages: list[dict]) -> str:
    """
    Non-streaming version for testing.
    Returns the complete response text.
    """
    full_response = ""
    async for chunk in chat_stream(messages):
        if "text-delta" in chunk:
            try:
                data = json.loads(chunk.replace("data: ", "").strip())
                if data.get("type") == "text-delta":
                    full_response += data.get("delta", "")
            except (json.JSONDecodeError, AttributeError):
                pass
    return full_response


async def compare_products(products: list, context: dict) -> str:
    """
    AI-powered product comparison.
    Takes a list of products and gift context, returns a structured comparison.
    """
    llm = ChatAnthropic(
        model="claude-sonnet-4-20250514",
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
        max_tokens=2048,
    )

    # Build product descriptions
    product_lines = []
    for i, p in enumerate(products, 1):
        line = f"Product {i}: {p.get('name', 'Unknown')}\n"
        line += f"  Price: {p.get('priceFormatted', 'N/A')}\n"
        line += f"  Description: {p.get('description', 'N/A')}\n"
        if p.get('allergyInfo'):
            line += f"  Allergens: {p['allergyInfo']}\n"
        if p.get('ingredients'):
            line += f"  Ingredients: {p['ingredients']}\n"
        if p.get('occasion'):
            line += f"  Occasion: {p['occasion']}\n"
        if p.get('category'):
            line += f"  Category: {p['category']}\n"
        if p.get('isOneHourDelivery'):
            line += f"  Same-Day Delivery: Yes\n"
        if p.get('sizeCount') and p['sizeCount'] > 1:
            line += f"  Size Options: {p['sizeCount']}\n"
        product_lines.append(line)

    products_text = "\n".join(product_lines)

    # Build context description
    context_parts = []
    if context.get('recipient'):
        context_parts.append(f"Recipient: {context['recipient']}")
    if context.get('occasion'):
        context_parts.append(f"Occasion: {context['occasion']}")
    if context.get('budget'):
        budget = context['budget']
        if isinstance(budget, dict) and budget.get('raw'):
            context_parts.append(f"Budget: {budget['raw']}")
        elif isinstance(budget, str):
            context_parts.append(f"Budget: {budget}")
    if context.get('preferences'):
        context_parts.append(f"Preferences: {', '.join(context['preferences'])}")
    if context.get('dietaryNeeds'):
        context_parts.append(f"Dietary Needs: {', '.join(context['dietaryNeeds'])}")

    context_text = "\n".join(context_parts) if context_parts else "No specific context provided."

    comparison_prompt = f"""You are an expert gift advisor for Edible Arrangements. Compare these products and provide a clear, helpful analysis.

PRODUCTS TO COMPARE:
{products_text}

GIFT CONTEXT:
{context_text}

Provide your comparison in this EXACT format:

For EACH product, give:
**[Product Name]**
Pros: (2-3 bullet points)
Cons: (1-2 bullet points)

Then end with:
**Recommendation:** Based on the context (recipient, occasion, budget, preferences), which product is the best fit and WHY. Be specific — reference the recipient's likely preferences, the occasion, and budget. Be rational and decisive.

RULES:
- Be concise — no more than 2-3 sentences per point
- Be honest — if a product is overpriced or doesn't fit the occasion, say so
- Reference the gift context in your recommendation
- If one product clearly fits better, say so confidently
- Consider allergens if the recipient has dietary needs
- Consider value for money"""

    messages = [
        SystemMessage(content="You are a helpful gift comparison advisor. Be concise, factual, and decisive."),
        HumanMessage(content=comparison_prompt),
    ]

    response = await llm.ainvoke(messages)
    return _extract_text(response.content)
