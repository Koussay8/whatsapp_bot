import Link from 'next/link';

export default function HomePage() {
    return (
        <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤖 Multi-Bot WhatsApp</h1>
            <p style={{ color: 'var(--muted)', marginBottom: '3rem', fontSize: '1.25rem' }}>
                Créez et gérez plusieurs bots WhatsApp
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <Link href="/admin">
                    <button className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1rem' }}>
                        🎛 Accéder au Dashboard
                    </button>
                </Link>
            </div>

            <div className="card" style={{ marginTop: '4rem', maxWidth: '600px', margin: '4rem auto', textAlign: 'left' }}>
                <h3 style={{ marginBottom: '1rem' }}>✨ Fonctionnalités</h3>
                <ul style={{ listStyle: 'none', lineHeight: '2' }}>
                    <li>🎤 Transcription vocale → Facture PDF</li>
                    <li>📧 Envoi automatique par email</li>
                    <li>🔄 Plusieurs bots simultanés</li>
                    <li>⚡ Activation/Désactivation individuelle</li>
                    <li>📱 QR code en temps réel</li>
                </ul>
            </div>
        </div>
    );
}
