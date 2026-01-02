'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET || 'admin';

export default function AdminPage() {
    const [bots, setBots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newBotName, setNewBotName] = useState('');

    const fetchBots = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/bots`, {
                headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
            });
            const data = await res.json();
            setBots(data.bots || []);
        } catch (e) {
            console.error('Failed to fetch bots:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBots();
        const interval = setInterval(fetchBots, 5000);
        return () => clearInterval(interval);
    }, []);

    const createBot = async () => {
        if (!newBotName.trim()) return;
        try {
            await fetch(`${API_URL}/api/admin/bots`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${ADMIN_SECRET}`,
                },
                body: JSON.stringify({ name: newBotName }),
            });
            setNewBotName('');
            fetchBots();
        } catch (e) {
            console.error('Failed to create bot:', e);
        }
    };

    const startBot = async (id) => {
        await fetch(`${API_URL}/api/admin/bots/${id}/start`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
        });
        fetchBots();
    };

    const stopBot = async (id) => {
        await fetch(`${API_URL}/api/admin/bots/${id}/stop`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
        });
        fetchBots();
    };

    const toggleEnabled = async (id, enabled) => {
        await fetch(`${API_URL}/api/admin/bots/${id}/enable`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${ADMIN_SECRET}`,
            },
            body: JSON.stringify({ enabled: !enabled }),
        });
        fetchBots();
    };

    const deleteBot = async (id) => {
        if (!confirm('Supprimer ce bot ?')) return;
        await fetch(`${API_URL}/api/admin/bots/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
        });
        fetchBots();
    };

    const connectedCount = bots.filter(b => b.status === 'connected').length;
    const enabledCount = bots.filter(b => b.enabled).length;

    if (loading) {
        return <div className="loading">Chargement...</div>;
    }

    return (
        <div className="container">
            <div className="header">
                <h1>🤖 Multi-Bot WhatsApp</h1>
                <div className="stats">
                    <div className="stat">
                        <div className="stat-value">{bots.length}</div>
                        <div className="stat-label">Total Bots</div>
                    </div>
                    <div className="stat">
                        <div className="stat-value">{connectedCount}</div>
                        <div className="stat-label">Connectés</div>
                    </div>
                    <div className="stat">
                        <div className="stat-value">{enabledCount}</div>
                        <div className="stat-label">Actifs</div>
                    </div>
                </div>
            </div>

            {/* Create new bot */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Créer un nouveau bot</h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <input
                        className="input"
                        placeholder="Nom du bot (ex: Bot Entreprise A)"
                        value={newBotName}
                        onChange={(e) => setNewBotName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && createBot()}
                    />
                    <button className="btn btn-primary" onClick={createBot}>
                        + Créer
                    </button>
                </div>
            </div>

            {/* Bot list */}
            <div className="bot-grid">
                {bots.map((bot) => (
                    <div key={bot.id} className="card bot-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div>
                                <h3>{bot.name || bot.id}</h3>
                                <span className={`status ${bot.status}`}>{bot.status}</span>
                            </div>
                            <div
                                className={`toggle ${bot.enabled ? 'active' : ''}`}
                                onClick={() => toggleEnabled(bot.id, bot.enabled)}
                                title={bot.enabled ? 'Désactiver' : 'Activer'}
                            />
                        </div>

                        {bot.phoneNumber && (
                            <p className="phone">📱 {bot.phoneNumber}</p>
                        )}

                        <div className="actions">
                            {bot.status === 'disconnected' || bot.status === 'logged_out' ? (
                                <button className="btn btn-success" onClick={() => startBot(bot.id)}>
                                    ▶ Démarrer
                                </button>
                            ) : (
                                <button className="btn btn-outline" onClick={() => stopBot(bot.id)}>
                                    ⏹ Arrêter
                                </button>
                            )}

                            {(bot.status === 'waiting_qr' || bot.hasQR) && (
                                <Link href={`/qr/${bot.id}`}>
                                    <button className="btn btn-primary">📱 QR Code</button>
                                </Link>
                            )}

                            <button className="btn btn-danger" onClick={() => deleteBot(bot.id)}>
                                🗑
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {bots.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
                        Aucun bot créé
                    </p>
                    <p>Créez votre premier bot ci-dessus 👆</p>
                </div>
            )}
        </div>
    );
}
