'use client';

interface WelcomeScreenProps {
    onQuickReply: (message: string) => void;
}

const starterOptions = [
    { emoji: '🎂', label: 'Shopping for a birthday' },
    { emoji: '❤️', label: "Valentine's Day gift" },
    { emoji: '🙏', label: 'Thank you gift' },
    { emoji: '🎁', label: 'Just browsing' },
];

export default function WelcomeScreen({ onQuickReply }: WelcomeScreenProps) {
    return (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center animate-fade-in-up">
            {/* Icon */}
            <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-6 shadow-lg"
                style={{
                    background: 'linear-gradient(135deg, var(--edible-red) 0%, var(--edible-red-light) 100%)',
                }}
            >
                🍓
            </div>

            {/* Greeting */}
            <h2
                className="text-2xl font-bold mb-2"
                style={{ color: 'var(--edible-dark)' }}
            >
                Hi there! 👋
            </h2>
            <p
                className="text-base mb-1 font-medium"
                style={{ color: 'var(--edible-dark)' }}
            >
                I&apos;m your Edible Gift Concierge
            </p>
            <p
                className="text-sm mb-8 max-w-md leading-relaxed"
                style={{ color: 'var(--edible-muted)' }}
            >
                I&apos;ll help you find the perfect fruit arrangement, chocolate-dipped
                treats, or gift basket for any occasion.
            </p>

            {/* Starter quick replies */}
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {starterOptions.map((option, index) => (
                    <button
                        key={option.label}
                        onClick={() => onQuickReply(`${option.emoji} ${option.label}`)}
                        className="quick-reply-btn px-4 py-2.5 rounded-full text-sm font-medium border cursor-pointer"
                        style={{
                            color: 'var(--edible-dark)',
                            borderColor: 'var(--edible-border)',
                            backgroundColor: 'var(--edible-card-bg)',
                            animationDelay: `${index * 0.08}s`,
                            animation: `fadeInUp 0.4s ease-out ${index * 0.08}s both`,
                        }}
                        aria-label={`Start with: ${option.label}`}
                    >
                        {option.emoji} {option.label}
                    </button>
                ))}
            </div>

            {/* Subtle hint */}
            <p
                className="text-xs mt-8"
                style={{ color: 'var(--edible-muted)' }}
            >
                Or type a message below to get started
            </p>
        </div>
    );
}
