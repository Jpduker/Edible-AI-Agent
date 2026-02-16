'use client';

export default function Header() {
    return (
        <header className="sticky top-0 z-50 border-b border-[var(--edible-border)]" style={{ backgroundColor: 'var(--edible-card-bg)' }}>
            {/* Accent stripe */}
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, var(--edible-red) 0%, var(--edible-red-light) 50%, var(--edible-red) 100%)' }} />

            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                {/* Logo mark */}
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
                    style={{ backgroundColor: 'var(--edible-red)' }}
                    aria-hidden="true"
                >
                    🍓
                </div>

                <div className="min-w-0">
                    <h1
                        className="text-lg font-bold leading-tight truncate"
                        style={{ color: 'var(--edible-dark)' }}
                    >
                        Edible Gift Concierge
                    </h1>
                    <p
                        className="text-xs leading-tight truncate"
                        style={{ color: 'var(--edible-muted)' }}
                    >
                        Find the perfect gift, powered by AI
                    </p>
                </div>

                {/* Edible brand link */}
                <a
                    href="https://www.ediblearrangements.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs font-medium px-3 py-1.5 rounded-full border transition-colors shrink-0"
                    style={{
                        color: 'var(--edible-red)',
                        borderColor: 'var(--edible-red)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--edible-red)';
                        e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--edible-red)';
                    }}
                >
                    edible.com
                </a>
            </div>
        </header>
    );
}
