import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../utils/auth';

const backButtonStyle = {
  position: 'absolute',
  top: '8px',
  left: '12px',
  zIndex: 1000,
  minWidth: '104px',
  padding: '9px 14px',
  border: '1px solid rgba(124, 19, 19, 0.92)',
  borderRadius: '6px',
  background: 'linear-gradient(180deg, rgba(108, 10, 10, 0.98), rgba(52, 5, 5, 0.99))',
  color: '#f9e6de',
  cursor: 'pointer',
  fontFamily: '"Trebuchet MS", sans-serif',
  fontSize: '0.92rem',
  fontWeight: 700,
  boxSizing: 'border-box',
  boxShadow: '0 10px 24px rgba(24, 3, 3, 0.48)',
};

const PyrrhicWarCompendium = () => {
  const navigate = useNavigate();
  const apiUrl = encodeURIComponent(API_URL);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100dvh',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => navigate('/projects/PyrrhicWar')}
        style={backButtonStyle}
      >
        &lt; Back
      </button>

      <iframe
        src={`/games/PyrrhicWar/PyrrhicWarCompendium.html?apiUrl=${apiUrl}`}
        title="Pyrrhic War Compendium"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  );
};

export default PyrrhicWarCompendium;
