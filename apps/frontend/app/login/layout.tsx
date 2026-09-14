import './login-overrides.css';
import './mobile-clean.css';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <a
        href="/register"
        aria-label="Create a PWFB account"
        style={{
          position: 'fixed',
          top: 18,
          right: 18,
          zIndex: 1000,
          padding: '10px 16px',
          borderRadius: 999,
          background: '#ffffff',
          color: '#087534',
          border: '1px solid #dce5df',
          boxShadow: '0 8px 24px rgba(5,55,28,.14)',
          fontSize: 12,
          fontWeight: 800,
          textDecoration: 'none',
        }}
      >
        Create account
      </a>
    </>
  );
}
