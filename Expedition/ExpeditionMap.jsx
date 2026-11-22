import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '../../utils/auth';

const ExpeditionMap = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const boardParams = new URLSearchParams({ apiUrl: API_URL });
  const tile = params.get('tile');
  if (tile) boardParams.set('tile', tile);
  const request = params.get('request');
  if (request) boardParams.set('request', request);

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
      {/* Back button */}
      <button
        onClick={() => navigate("/projects/Expedition")}
        style={{
          position: "absolute",
          top: "8px",
          left: "12px",
          zIndex: 1000,
          minWidth: "104px",
          padding: "9px 14px",
          border: "1px solid #666",
          borderRadius: "6px",
          background: "#202020",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
          fontSize: "0.92rem",
          fontWeight: 700,
          boxSizing: "border-box",
          cursor: "pointer",
        }}
      >
        &lt; Back 
      </button>
      <iframe
        src={`/games/Expedition/ExpeditionMap.html?${boardParams}`}
        title="Expedition Crusade Board"
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

export default ExpeditionMap;
