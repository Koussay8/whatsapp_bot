import './globals.css';

export const metadata = {
    title: 'WhatsApp Bot Admin',
    description: 'Gérez vos bots WhatsApp',
};

export default function RootLayout({ children }) {
    return (
        <html lang="fr">
            <body>{children}</body>
        </html>
    );
}
