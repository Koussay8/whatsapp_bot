'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function QRPage() {
    const params = useParams();
    const botId = params.id;
    const [qrCode, setQrCode] = useState(null);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchQR = async () => {
            try {
                const res = await fetch(`${API_URL}/api/bots/${botId}/qr`);
                const data = await res.json();

                if (data.qrCode) {
                    setQrCode(data.qrCode);
                    setStatus('waiting_qr');
                } else if (data.status === 'connected') {
                    setStatus('connected');
                    setQrCode(null);
                } else {
                    setStatus(data.status || 'unknown');
                }
            } catch (e) {
                setError(e.message);
            }
        };

        fetchQR();
        const interval = setInterval(fetchQR, 3000); // Refresh every 3s
        return () => clearInterval(interval);
    }, [botId]);

    return (
        <div className="container">
            <div className="header">
                <Link href="/admin">
                    <button className="btn btn-outline">← Retour</button>
                </Link>
                <h1>Scanner QR Code</h1>
            </div>

            <div className="card qr-container">
                {error && (
                    <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>
                        Erreur: {error}
                    </div>
                )}

                {status === 'connected' && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
                        <h2>Bot Connecté!</h2>
                        <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>
                            Le bot WhatsApp est prêt à recevoir des messages
                        </p>
                        <Link href="/admin">
                            <button className="btn btn-primary" style={{ marginTop: '2rem' }}>
                                Retour au Dashboard
                            </button>
                        </Link>
                    </div>
                )}

                {status === 'waiting_qr' && qrCode && (
                    <>
                        <img src={qrCode} alt="QR Code WhatsApp" />
                        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                            <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                                📱 Scannez ce QR code avec WhatsApp
                            </p>
                            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                                WhatsApp → Paramètres → Appareils connectés → Connecter
                            </p>
                            <p style={{ color: 'var(--warning)', fontSize: '0.75rem', marginTop: '1rem' }}>
                                ⏱ Le QR code se rafraîchit automatiquement
                            </p>
                        </div>
                    </>
                )}

                {status === 'loading' && (
                    <div className="loading">
                        Chargement du QR code...
                    </div>
                )}

                {status === 'disconnected' && (
                    <div style={{ textAlign: 'center' }}>
                        <p>Bot non démarré</p>
                        <Link href="/admin">
                            <button className="btn btn-primary" style={{ marginTop: '1rem' }}>
                                Démarrer le bot
                            </button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
