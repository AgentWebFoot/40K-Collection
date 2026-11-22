const textStyle = { margin: 0, color: '#ddd', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };

export default function EquipmentRules({ equipment, showEmptyAbility = false }) {
  if (!showEmptyAbility && !equipment.description && !equipment.action) return null;

  return (
    <div style={{ display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
      <div>
        <strong>Ability</strong>
        <p style={textStyle}>{equipment.description || 'No ability entered yet.'}</p>
      </div>
      {equipment.action && (
        <div>
          <strong>Action</strong>
          <p style={textStyle}>{equipment.action}</p>
        </div>
      )}
    </div>
  );
}
