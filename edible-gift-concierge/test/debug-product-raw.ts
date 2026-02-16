


async function main() {
    console.log('--- Debugging Raw Edible API Response ---');

    try {
        const response = await fetch('https://www.ediblearrangements.com/api/search/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'EdibleGiftConcierge/1.0',
            },
            body: JSON.stringify({ keyword: 'birthday gifts under $50' }),
        });

        if (!response.ok) {
            console.error(`API returned status ${response.status}`);
            return;
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            console.error('Unexpected response format:', typeof data);
            return;
        }

        console.log(`Found ${data.length} products.`);

        // Log first 3 raw items to inspect fields
        console.log('\n--- First 3 Raw Items ---');
        data.slice(0, 3).forEach((item, index) => {
            console.log(`\nItem ${index + 1}:`);
            console.log('id:', item.id);
            console.log('number:', item.number);
            console.log('code:', item.code); // Maybe 'code' is the ID?
            console.log('minPrice:', item.minPrice);
            console.log('maxPrice:', item.maxPrice);
            console.log('price:', item.price);
            console.log('name:', item.name);
        });

        // Check for duplicate IDs
        const ids = data.map(item => item.id || item.number || 'MISSING');
        const uniqueIds = new Set(ids);
        console.log(`\nTotal IDs: ${ids.length}`);
        console.log(`Unique IDs: ${uniqueIds.size}`);

        if (uniqueIds.size !== ids.length) {
            console.log('WARNING: Duplicate IDs found!');
            // Show duplicates
            const duplicates = ids.filter((item, index) => ids.indexOf(item) !== index);
            console.log('First 5 duplicates:', duplicates.slice(0, 5));
        } else {
            console.log('All IDs are unique.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch(console.error);
