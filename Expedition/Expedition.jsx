import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const styles = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '24px',
    boxSizing: 'border-box',
    background: '#1e1e1e',
    color: '#ffffff',
    fontFamily: 'system-ui, sans-serif',
    textAlign: 'center',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '14px',
    padding: '18px',
    border: '1px solid #444',
    borderRadius: '8px',
    background: '#2a2a2a',
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35)',
  },
  titleBox: {
    minWidth: '374px',
    maxWidth: '100%',
    padding: '14px 18px',
    border: '1px solid #444',
    borderRadius: '8px',
    background: '#2a2a2a',
    color: '#ffffff',
    fontSize: '1.25rem',
    fontWeight: 700,
    boxSizing: 'border-box',
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35)',
  },
  button: {
    minWidth: '180px',
    padding: '12px 18px',
    border: '1px solid #666',
    borderRadius: '6px',
    background: '#202020',
    color: '#ffffff',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '1rem',
    fontWeight: 700,
    textDecoration: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  disabledButton: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  backButton: {
    position: 'absolute',
    top: '8px',
    left: '12px',
    zIndex: 1000,
    minWidth: '104px',
    padding: '9px 14px',
    border: '1px solid #666',
    borderRadius: '6px',
    background: '#202020',
    color: '#ffffff',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.92rem',
    fontWeight: 700,
    boxSizing: 'border-box',
  },
};

export default function Expedition() {
  const navigate = useNavigate();

  return (
    <main style={styles.page}>
      <button type="button" onClick={() => navigate('/projects')} style={styles.backButton}>
        &lt; Back
      </button>
      <div style={styles.titleBox}>Expedition</div>
      <div style={styles.actions}>
        <button type="button" style={{ ...styles.button, ...styles.disabledButton }}>
          Compendium
        </button>
        <Link to="/projects/ExpeditionMap" style={styles.button}>
          Map
        </Link>
      </div>
    </main>
  );
}
