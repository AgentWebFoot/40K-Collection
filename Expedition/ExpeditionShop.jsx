import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchJson, getAuthEventName } from '../../utils/auth';

const styles = {
  page: { minHeight: '100%', padding: 'clamp(16px, 4vw, 40px)', background: '#1e1e1e', color: '#fff', fontFamily: 'system-ui, sans-serif' },
  layout: { display: 'grid', gap: '18px', width: '100%', maxWidth: '900px', margin: '0 auto' },
  link: { color: '#eee', textUnderlineOffset: '4px', justifySelf: 'start' },
  title: { margin: 0, color: 'inherit', font: '700 1.8rem system-ui, sans-serif' },
  heading: { margin: 0, fontSize: '1.1rem' },
  stack: { display: 'grid', gap: '12px' },
  card: { display: 'grid', gap: '12px', minWidth: 0, padding: '16px', background: '#272727', border: '1px solid #4a4a4a', borderRadius: '8px', overflowWrap: 'anywhere' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' },
  formFields: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '12px' },
  fieldset: { display: 'grid', gap: '12px', minWidth: 0, margin: 0, padding: 0, border: 0 },
  label: { display: 'grid', gap: '5px', alignContent: 'start', fontSize: '0.875rem' },
  checkbox: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' },
  field: { width: '100%', minWidth: 0, boxSizing: 'border-box', color: '#fff', background: '#191919', border: '1px solid #666', borderRadius: '6px', font: 'inherit', padding: '8px 10px' },
  button: { color: '#fff', background: '#353535', border: '1px solid #666', borderRadius: '6px', font: 'inherit', padding: '8px 12px', justifySelf: 'start' },
  note: { color: '#ddd', margin: 0 },
  error: { color: '#ffb5a7', margin: 0 },
  description: { color: '#ddd', margin: 0, whiteSpace: 'pre-wrap' },
};

async function shopRequest(path, method, body, signal) {
  const { response, payload } = await fetchJson(`/expedition/shop${path}`, {
    method, ...(body && { body: JSON.stringify(body) }), signal,
  });
  if (!response.ok) {
    const error = new Error(payload?.message || 'Unable to complete the shop request.');
    if (Array.isArray(payload?.items)) error.catalog = payload;
    throw error;
  }
  return payload;
}

function ShopListingForm({ busy, onCreate }) {
  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    onCreate({
      name: fields.get('name').trim(),
      description: fields.get('description').trim(),
      cost: form.elements.namedItem('cost').valueAsNumber,
    }, () => form.reset());
  }

  return (
    <form aria-labelledby="expedition-shop-add" onSubmit={submit} style={styles.card}>
      <h3 id="expedition-shop-add" style={styles.heading}>Add Equipment</h3>
      <fieldset disabled={busy} style={styles.fieldset}>
        <div style={styles.formFields}>
          <label style={styles.label}>Name
            <input name="name" maxLength={100} required style={styles.field} />
          </label>
          <label style={styles.label}>Cost in credits
            <input name="cost" type="number" min="0" max={Number.MAX_SAFE_INTEGER} step="1" required style={styles.field} />
          </label>
        </div>
        <label style={styles.label}>Description
          <textarea name="description" rows={3} maxLength={2000} required style={styles.field} />
        </label>
        <button type="submit" style={styles.button}>Add to Backrooms</button>
      </fieldset>
    </form>
  );
}

function StockLimit({ label, name, initial }) {
  const [unlimited, setUnlimited] = useState(initial === null);
  return (
    <div style={styles.stack}>
      <label style={styles.label}>{label}
        <input name={name} type="number" min="1" max={Number.MAX_SAFE_INTEGER} step="1"
          defaultValue={Math.max(1, initial ?? 1)} disabled={unlimited} required style={styles.field} />
      </label>
      <label style={styles.checkbox}>
        <input type="checkbox" checked={unlimited} onChange={event => setUnlimited(event.target.checked)} /> Unlimited {label.toLowerCase()}
      </label>
    </div>
  );
}

function StockForm({ item, busy, onStock, onCancel }) {
  function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const limit = name => data.has(name) ? Number(data.get(name)) : null;
    onStock({ perUser: limit('perUser'), total: limit('total') });
  }
  return (
    <form onSubmit={submit} style={styles.card} aria-label={`Stock ${item.name}`}>
      <fieldset disabled={busy} style={styles.fieldset}>
        <div style={styles.formFields}>
          <StockLimit label="Amount per user" name="perUser" initial={item.perUser} />
          <StockLimit label="Total amount" name="total" initial={item.remaining} />
        </div>
        <p style={styles.note}>Amount per user limits how many copies each player can buy. Total amount sets the stock currently available.</p>
        <div style={styles.row}>
          <button type="submit" style={styles.button}>Save stock</button>
          <button type="button" style={styles.button} onClick={onCancel}>Cancel</button>
        </div>
      </fieldset>
    </form>
  );
}

function ShopListing({ item, children }) {
  return (
    <article style={styles.card}>
      <div style={styles.row}>
        <h3 style={styles.heading}>{item.name}</h3>
        <strong>{item.cost.toLocaleString()} {item.cost === 1 ? 'credit' : 'credits'}</strong>
      </div>
      <p style={styles.description}>{item.description}</p>
      {children}
    </article>
  );
}

function PurchaseForm({ item, credits, busy, onPurchase }) {
  const cap = item.perUser === null ? Infinity : item.perUser - item.owned;
  const affordable = item.cost === 0 ? Infinity : Math.floor(credits / item.cost);
  const max = Math.min(Number.MAX_SAFE_INTEGER, item.remaining ?? Infinity, cap, affordable);
  if (item.remaining === 0) return null;
  if (cap <= 0) return <p style={styles.note}>You’ve reached the purchase limit for this item.</p>;
  if (affordable === 0) return <p style={styles.note}>Your team does not have enough credits.</p>;

  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const quantity = form.elements.namedItem('quantity')?.valueAsNumber ?? 1;
    onPurchase(quantity, () => form.reset());
  }

  return (
    <form onSubmit={submit} style={{ ...styles.row, justifyContent: 'start', alignItems: 'end' }}>
      {max > 1 && <label style={styles.label}>Quantity
        <input name="quantity" type="number" min="1" max={max} step="1" defaultValue="1" required disabled={busy}
          style={{ ...styles.field, width: '105px' }} />
      </label>}
      <button type="submit" disabled={busy} style={styles.button} aria-label={`Buy ${item.name}`}>Buy</button>
    </form>
  );
}

export default function ExpeditionShop() {
  const [authRevision, setAuthRevision] = useState(0);
  useEffect(() => {
    const event = getAuthEventName();
    const refresh = () => setAuthRevision(value => value + 1);
    window.addEventListener(event, refresh);
    return () => window.removeEventListener(event, refresh);
  }, []);
  return <ShopPage key={authRevision} />;
}

function ShopPage() {
  const [catalog, setCatalog] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [search, setSearch] = useState('');
  const [stockId, setStockId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    shopRequest('', 'GET', undefined, signal).then(payload => {
      if (!Array.isArray(payload?.items)) throw new Error('Unable to load the shop.');
      if (!signal.aborted) setCatalog(payload);
    }).catch(error => {
      if (!signal.aborted) setLoadError(error.message);
    });
    return () => controller.abort();
  }, [reload]);

  async function saveListing(path, method, body, onSaved) {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await shopRequest(path, method, body);
      setCatalog(result);
      onSaved?.();
      setFeedback({ message: result.message });
    } catch (error) {
      if (error.catalog) setCatalog(error.catalog);
      setFeedback({ error: true, message: error.message });
    } finally {
      setBusy(false);
    }
  }

  const storefront = catalog?.items.filter(item => item.visible) ?? [];
  const query = search.trim().toLowerCase();
  const backrooms = catalog?.items.filter(item => (
    item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query)
  )) ?? [];

  function removeFromStorefront(item) {
    if (window.confirm(`Remove "${item.name}" from Storefront? It will remain in Backrooms.`)) {
      saveListing('', 'PATCH', { id: item.id, visible: false });
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.layout}>
        <Link to="/projects/Expedition" style={styles.link}>← Back to Expedition</Link>
        <h1 style={styles.title}>Expedition Shop</h1>
        {loadError && (
          <div style={styles.card}>
            <p role="alert" style={styles.error}>{loadError}</p>
            <button type="button" style={styles.button} onClick={() => {
              setLoadError('');
              setReload(value => value + 1);
            }}>Retry</button>
          </div>
        )}
        {!loadError && !catalog && <p role="status" style={styles.note}>Loading the shop…</p>}
        {feedback && <p role={feedback.error ? 'alert' : 'status'} style={feedback.error ? styles.error : styles.note}>{feedback.message}</p>}
        {catalog && (
          <section aria-labelledby="expedition-storefront" style={styles.stack}>
            <div style={styles.row}>
              <h2 id="expedition-storefront" style={styles.heading}>Storefront</h2>
              {catalog.canPurchase && (
                <span style={styles.note}>{catalog.credits.toLocaleString()} team credits · <Link to="/projects/ExpeditionTeams" style={styles.link}>Team Equipment</Link></span>
              )}
            </div>
            {storefront.length === 0 && <p style={styles.note}>No equipment is stocked in Storefront.</p>}
            {storefront.map(item => (
              <ShopListing key={item.id} item={item}>
                <p style={styles.note}>
                  {item.remaining === 0 ? 'Sold out' : item.remaining === null ? 'Unlimited stock' : `${item.remaining.toLocaleString()} in stock`}
                  {' · '}{item.perUser === null ? 'Unlimited per user' : `${item.perUser.toLocaleString()} per user`}
                </p>
                {catalog.canPurchase && (
                  <PurchaseForm item={item} credits={catalog.credits} busy={busy}
                    onPurchase={(quantity, onSaved) => saveListing('/purchase', 'POST', { id: item.id, quantity }, onSaved)} />
                )}
                {catalog.canManage && (
                  <button type="button" style={styles.button} disabled={busy} aria-label={`Remove ${item.name} from Storefront`}
                    onClick={() => removeFromStorefront(item)}>Remove from Storefront</button>
                )}
              </ShopListing>
            ))}
          </section>
        )}
        {catalog?.canManage && (
          <section aria-labelledby="expedition-backrooms" style={styles.stack}>
            <h2 id="expedition-backrooms" style={styles.heading}>Backrooms</h2>
            <label style={styles.label}>Search Backrooms
              <input type="search" value={search} onChange={event => setSearch(event.target.value)} style={styles.field} />
            </label>
            {backrooms.length === 0 && <p style={styles.note}>{query ? 'No matching equipment.' : 'No equipment in Backrooms yet.'}</p>}
            {backrooms.map(item => (
              <ShopListing key={item.id} item={item}>
                <div style={styles.row}>
                  <span style={styles.note}>{item.visible ? 'On Storefront' : 'In Backrooms only'}</span>
                  <button type="button" style={styles.button} disabled={busy} aria-label={`Stock ${item.name}`}
                    aria-expanded={stockId === item.id} onClick={() => setStockId(current => current === item.id ? null : item.id)}>Stock</button>
                </div>
                {stockId === item.id && (
                  <StockForm item={item} busy={busy} onCancel={() => setStockId(null)}
                    onStock={stock => saveListing('', 'PATCH', { id: item.id, stock }, () => setStockId(null))} />
                )}
              </ShopListing>
            ))}
            <ShopListingForm busy={busy} onCreate={(body, onSaved) => saveListing('', 'POST', body, onSaved)} />
          </section>
        )}
      </div>
    </main>
  );
}
