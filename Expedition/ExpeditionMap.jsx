import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, readStoredUser, refreshStoredUser } from '../../utils/auth';

const ExpeditionMap = () => {
  const [resolvedRole, setResolvedRole] = useState(() => readStoredUser()?.role || 'viewer');
  const navigate = useNavigate();
  const apiUrl = encodeURIComponent(API_URL);

  useEffect(() => {
    let ignore = false;

    async function refreshCurrentUserRole() {
      try {
        const refreshedUser = await refreshStoredUser();

        if (!ignore && refreshedUser) {
          setResolvedRole(refreshedUser.role || 'viewer');
        }
      } catch (_error) {
        if (!ignore) {
          setResolvedRole(readStoredUser()?.role || 'viewer');
        }
      }
    }

    refreshCurrentUserRole();

    return () => {
      ignore = true;
    };
  }, []);

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
        src={`/games/Expedition/ExpeditionMap.html?role=${encodeURIComponent(resolvedRole)}&apiUrl=${apiUrl}`}
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
