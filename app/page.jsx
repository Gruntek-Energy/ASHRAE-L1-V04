'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { runAnalysis} from '../lib/api';

// ---------- helpers ----------
function newSessionId() {
  try {
    const raw =
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return `sess_${raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;
  } catch {
    return `sess_${Date.now().toString(36)}`;
  }
}

export default function Page() {
  // ---------- session (hydration‑safe) ----------
  const [sessionId, setSessionId] = useState('');
  useEffect(() => {
    setSessionId(newSessionId());
  }, []);
  const isSessionReady = !!sessionId;

  // ---------- inputs ----------
  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    role: '',
  });

  const [facility, setFacility] = useState({
    type: 'Office',
    area_m2: 1200,
    yearBuilt: 2010,
    floors: 10,
    occupancy: 300,
    hours_per_week: 60,
    location: 'Dubai',
    utilityProvider: '',
    meterId: '',
    bms: { present: false, trending: 'Unknown', vendor: '', version: '', notes: '' },
    hvac: {
      systemType: 'Chilled Water',
      coolingCapacityTR: 500,
      numChillers: 2,
      chillerMakeModel: '',
      boilersPresent: false,
      boilerFuel: 'Electric',
      ventilationControl: 'Schedule',
    },
    lighting: { predominant: 'LED', controls: ['Manual Switches'] },
    envelope: { glazing: 'Double', insulationLevel: 'Medium', roofType: '' },
  });

  const [energy, setEnergy] = useState({
    annual_kwh: 180000,
    annual_cooling_kwh: 0,
    tariff_aed_per_kwh: 0.35,
    emission_factor_kg_per_kwh: 0.35,
    carbon_factor_kg_per_kwh: 0.35,
    best_possible_eui: 110,
    gas_annual_mmbtu: 0,
    diesel_annual_liters: 0,
  });

  const [targets, setTargets] = useState({
    budgetAED: 0,
    paybackTargetYears: 3,
  });

  // Attachments {/* paste S3 keys / URLs */}
  const [fileListRaw, setFileListRaw] = useState('');
  // Upload UI state
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});


  // ---------- run / status / results ----------
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ kind: 'idle' });
  const [result, setResult] = useState(null);

  const canRun = useMemo(() => {
    return (
      isSessionReady &&
      !!customer.name &&
      !!customer.email &&
      facility.area_m2 > 0 &&
      energy.annual_kwh >= 0
    );
  }, [isSessionReady, customer.name, customer.email, facility.area_m2, energy.annual_kwh]);

  // ---------- actions ----------
  function parseFiles(){
    return fileListRaw
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
  }

  
  async function handleFileChange(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadBusy(true);
    setUploadMsg(null);
    setUploadProgress({});

    try {
      const uploaded = [];
      for (const f of Array.from(files)) {
        // Get presigned URL + key from API Gateway
        const res = await fetch(
          `https://yuryvu9c3c.execute-api.us-east-1.amazonaws.com?filename=${encodeURIComponent(f.name)}&type=${encodeURIComponent(f.type || 'application/octet-stream')}`
        );
        if (!res.ok) throw new Error(`Failed to get signed URL for ${f.name}`);
        const { url, key } = await res.json();

        // PUT to S3 with progress
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', url);
          xhr.setRequestHeader('Content-Type', f.type || 'application/octet-stream');
          xhr.upload.onprogress = evt => {
            if (evt.lengthComputable) {
              setUploadProgress(p => ({ ...p, [f.name]: Math.round((evt.loaded / evt.total) * 100) }));
            }
          };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 error ${xhr.status}`)));
          xhr.onerror = () => reject(new Error('Network error'));
          xhr.send(f);
        });

        uploaded.push(key);
      }

      // Merge keys into textarea (dedupe)
      const merged = Array.from(new Set([
        ...fileListRaw.split('\n').map(s => s.trim()).filter(Boolean),
        ...uploaded
      ])).join('\n');
      setFileListRaw(merged);
      setUploadMsg(`Uploaded ${uploaded.length} file(s).`);
    } catch (err) {
      console.error(err);
      setUploadMsg(err?.message ?? 'Upload failed.');
    } finally {
      if (e.target) e.target.value = '';
      setUploadBusy(false);
    }
  }

  async function onRun() {
    if (!canRun) return;
    setBusy(true);
    setStatus({ kind: 'idle' });
    setResult(null);

    const payload= {
      customer,
      facility: {
        ...facility,
        bms: facility.bms || { present: false, trending: 'Unknown' },
        hvac: facility.hvac || {},
        lighting: facility.lighting || {},
        envelope: facility.envelope || {},
      },
      energy: {
        ...energy,
        carbon_factor_kg_per_kwh:
          energy.emission_factor_kg_per_kwh ?? energy.carbon_factor_kg_per_kwh ?? 0.35,
      },
      targets,
    };

    try {
      const data = await runAnalysis({
        sessionId,
        customerData: payload,
        files: parseFiles(),
      });
      setResult(data);
      if (data.ok) setStatus({ kind: 'ok', msg: 'Analysis complete' });
      else setStatus({ kind: 'err', msg: data.error || `Request failed (status ${data.status ?? 'unknown'})` });
    } catch (e) {
      setStatus({ kind: 'err', msg: e?.message || 'Unexpected error' });
    } finally {
      setBusy(false);
    }
  }

  function onNewSession() {
    setSessionId(newSessionId());
    setResult(null);
    setStatus({ kind: 'idle' });
  }

// --- S3 upload helper ---
const [uploading, setUploading] = useState(false);
async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  setUploading(true);
  try {
    for (const f of files) {
      const presign = await fetch(
        `/api/s3/presign?filename=${encodeURIComponent(f.name)}&type=${encodeURIComponent(
          f.type || "application/octet-stream"
        )}&sessionId=${encodeURIComponent(sessionId)}`
      ).then(r => r.json());

      if (!presign?.uploadUrl || !presign?.key) {
        throw new Error(presign?.error || "Failed to get upload URL");
      }
      // Upload straight to S3
      await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": f.type || "application/octet-stream" },
        body: f,
      });

      // Append the S3 key into the textarea
      setFileListRaw(prev =>
        (prev ? prev + "\n" : "") + presign.key
      );
    }
  } catch (err) {
    console.error(err);
    alert((err as any)?.message || "Upload failed");
  } finally {
    setUploading(false);
    // reset the file input so the same file can be selected again if needed
    e.target.value = "";
  }
}

  // ---------- UI ----------
  return (
    <div className="container">
      <div className="row header">
        <div>
          <h1>Grüntek — ASHRAE Level 1 (Preliminary)</h1>
          <div className="muted">Fill the intake, optionally add document links/keys, then run analysis.</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn secondary" onClick={onNewSession}>New session</button>
          <button className="btn" disabled={!canRun || busy} onClick={onRun}>
            {busy ? 'Running…' : 'Start analysis'}
          </button>
        </div>
      </div>

      {/* Customer */}
      <div className="card">
        <h2>Customer</h2>
        <div className="grid">
          <div>
            <label>Name *</label>
            <input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} placeholder="Full name" />
          </div>
          <div>
            <label>Email *</label>
            <input type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} placeholder="name@company.com" />
          </div>
          <div>
            <label>Company</label>
            <input value={customer.company || ''} onChange={e => setCustomer({ ...customer, company: e.target.value })} placeholder="(optional)" />
          </div>
          <div>
            <label>Phone</label>
            <input value={customer.phone || ''} onChange={e => setCustomer({ ...customer, phone: e.target.value })} placeholder="+971…" />
          </div>
          <div className="col2">
            <label>Role</label>
            <input value={customer.role || ''} onChange={e => setCustomer({ ...customer, role: e.target.value })} placeholder="e.g., Facilities Manager" />
          </div>
        </div>
      </div>

      {/* Facility */}
      <div className="card">
        <h2>Facility</h2>
        <div className="grid">
          <div>
            <label>Building name</label>
            <input value={facility.buildingName || ''} onChange={e => setFacility({ ...facility, buildingName: e.target.value })} placeholder="e.g., Test HQ" />
          </div>
          <div>
            <label>Building type</label>
            <select
              value={facility.type}
              onChange={e => setFacility({ ...facility, type: e.target.value })}
            >
              {['Office','Retail','Hotel','Hospital','School','Warehouse','Residential','Other'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label>Year built</label>
            <input type="number" value={facility.yearBuilt || 0} onChange={e => setFacility({ ...facility, yearBuilt: Number(e.target.value || 0) })} />
          </div>
          <div>
            <label>Area (m²) *</label>
            <input type="number" value={facility.area_m2} onChange={e => setFacility({ ...facility, area_m2: Number(e.target.value || 0) })} />
          </div>
          <div>
            <label>Floors</label>
            <input type="number" value={facility.floors || 0} onChange={e => setFacility({ ...facility, floors: Number(e.target.value || 0) })} />
          </div>
          <div>
            <label>Occupancy (persons)</label>
            <input type="number" value={facility.occupancy || 0} onChange={e => setFacility({ ...facility, occupancy: Number(e.target.value || 0) })} />
          </div>
          <div>
            <label>Operating hours (per week)</label>
            <input type="number" value={facility.hours_per_week || 0} onChange={e => setFacility({ ...facility, hours_per_week: Number(e.target.value || 0) })} />
          </div>
          <div>
            <label>Location (city / emirate)</label>
            <input value={facility.location || ''} onChange={e => setFacility({ ...facility, location: e.target.value })} />
          </div>
          <div>
            <label>Utility provider</label>
            <input value={facility.utilityProvider || ''} onChange={e => setFacility({ ...facility, utilityProvider: e.target.value })} />
          </div>
          <div>
            <label>Meter / Account ID</label>
            <input value={facility.meterId || ''} onChange={e => setFacility({ ...facility, meterId: e.target.value })} />
          </div>
        </div>

        <h3 style={{ marginTop: 16 }}>Controls / BMS</h3>
        <div className="grid">
          <div>
            <label>BMS present?</label>
            <select
              value={String(facility.bms?.present ?? false)}
              onChange={e => setFacility({ ...facility, bms: { ...(facility.bms||{}), present: e.target.value === 'true' } })}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label>BMS vendor</label>
            <input value={facility.bms?.vendor || ''} onChange={e => setFacility({ ...facility, bms: { ...(facility.bms||{}), vendor: e.target.value } })} />
          </div>
          <div>
            <label>BMS version</label>
            <input value={facility.bms?.version || ''} onChange={e => setFacility({ ...facility, bms: { ...(facility.bms||{}), version: e.target.value } })} />
          </div>
          <div>
            <label>Trending available?</label>
            <select
              value={facility.bms?.trending || 'Unknown'}
              onChange={e => setFacility({ ...facility, bms: { ...(facility.bms||{}), trending: e.target.value } })}
            >
              <option>Yes</option><option>No</option><option>Unknown</option>
            </select>
          </div>
          <div className="col2">
            <label>Notes</label>
            <input value={facility.bms?.notes || ''} onChange={e => setFacility({ ...facility, bms: { ...(facility.bms||{}), notes: e.target.value } })} />
          </div>
        </div>

        <h3 style={{ marginTop: 16 }}>HVAC</h3>
        <div className="grid">
          <div>
            <label>System type</label>
            <select
              value={facility.hvac?.systemType || 'Chilled Water'}
              onChange={e => setFacility({ ...facility, hvac: { ...(facility.hvac||{}), systemType: e.target.value } })}
            >
              {['DX','Chilled Water','VRF','Package Units','District Cooling','Other'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label>Cooling capacity (TR)</label>
            <input type="number" value={facility.hvac?.coolingCapacityTR || 0} onChange={e => setFacility({ ...facility, hvac: { ...(facility.hvac||{}), coolingCapacityTR: Number(e.target.value || 0) } })} />
          </div>
          <div>
            <label># of chillers</label>
            <input type="number" value={facility.hvac?.numChillers || 0} onChange={e => setFacility({ ...facility, hvac: { ...(facility.hvac||{}), numChillers: Number(e.target.value || 0) } })} />
          </div>
          <div>
            <label>Chiller make / model</label>
            <input value={facility.hvac?.chillerMakeModel || ''} onChange={e => setFacility({ ...facility, hvac: { ...(facility.hvac||{}), chillerMakeModel: e.target.value } })} />
          </div>
          <div>
            <label>Boilers present?</label>
            <select
              value={String(facility.hvac?.boilersPresent ?? false)}
              onChange={e => setFacility({ ...facility, hvac: { ...(facility.hvac||{}), boilersPresent: e.target.value === 'true' } })}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label>Boiler fuel</label>
            <select
              value={facility.hvac?.boilerFuel || 'Electric'}
              onChange={e => setFacility({ ...facility, hvac: { ...(facility.hvac||{}), boilerFuel: e.target.value } })}
            >
              {['Gas','Diesel','Electric','None','Other'].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label>Ventilation control</label>
            <select
              value={facility.hvac?.ventilationControl || 'Schedule'}
              onChange={e => setFacility({ ...facility, hvac: { ...(facility.hvac||{}), ventilationControl: e.target.value } })}
            >
              {['CO2','Schedule','Manual','BMS','Other'].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        <h3 style={{ marginTop: 16 }}>Lighting</h3>
        <div className="grid">
          <div>
            <label>Predominant type</label>
            <select
              value={facility.lighting?.predominant || 'LED'}
              onChange={e => setFacility({ ...facility, lighting: { ...(facility.lighting||{}), predominant: e.target.value } })}
            >
              {['LED','Fluorescent','HID','Incandescent','Mixed','Other'].map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="col2">
            <label>Controls</label>
            <select
              multiple
              value={facility.lighting?.controls || []}
              onChange={e => {
                const opts = Array.from(e.target.selectedOptions).map(o => o.value);
                setFacility({ ...facility, lighting: { ...(facility.lighting||{}), controls: opts } });
              }}
            >
              {['Manual Switches','Occupancy Sensors','Daylight Sensors','BMS','Timer'].map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        </div>

        <h3 style={{ marginTop: 16 }}>Envelope</h3>
        <div className="grid">
          <div>
            <label>Glazing</label>
            <select
              value={facility.envelope?.glazing || 'Double'}
              onChange={e => setFacility({ ...facility, envelope: { ...(facility.envelope||{}), glazing: e.target.value } })}
            >
              {['Single','Double','Triple','Low‑E','Other'].map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div>
            <label>Insulation level</label>
            <select
              value={facility.envelope?.insulationLevel || 'Medium'}
              onChange={e => setFacility({ ...facility, envelope: { ...(facility.envelope||{}), insulationLevel: e.target.value } })}
            >
              {['Low','Medium','High','Unknown'].map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="col2">
            <label>Roof type</label>
            <input value={facility.envelope?.roofType || ''} onChange={e => setFacility({ ...facility, envelope: { ...(facility.envelope||{}), roofType: e.target.value } })} />
          </div>
        </div>
      </div>

      {/* Energy */}
      <div className="card">
        <h2>Energy</h2>
        <div className="grid">
          <div>
            <label>Annual electricity (kWh) *</label>
            <input type="number" value={energy.annual_kwh} onChange={e => setEnergy({ ...energy, annual_kwh: Number(e.target.value || 0) })} />
          </div>
          <div>
            <label>Operating tariff (AED/kWh)</label>
            <input type="number" step="0.01" value={energy.tariff_aed_per_kwh ?? 0} onChange={e => setEnergy({ ...energy, tariff_aed_per_kwh: Number(e.target.value || 0) })} />
          </div>
          <div>
            <label>Emission factor (kg CO₂ / kWh)</label>
            <input type="number" step="0.001" value={energy.emission_factor_kg_per_kwh ?? 0.35} onChange={e => setEnergy({ ...energy, emission_factor_kg_per_kwh: Number(e.target.value || 0) })} />
          </div>
          <div>
            <label>Best‑possible EUI target (kWh/m²·yr)</label>
            <input type="number" step="0.1" value={energy.best_possible_eui ?? 110} onChange={e => setEnergy({ ...energy, best_possible_eui: Number(e.target.value || 0) })} />
          </div>

          <div>
            <label>Cooling electricity (kWh)</label>
            <input type="number" value={energy.annual_cooling_kwh ?? 0} onChange={e => setEnergy({ ...energy, annual_cooling_kwh: Number(e.target.value || 0) })} />
          </div>
          <div>
            <label>Gas (MMBtu / yr)</label>
            <input type="number" value={energy.gas_annual_mmbtu ?? 0} onChange={e => setEnergy({ ...energy, gas_annual_mmbtu: Number(e.target.value || 0) })} />
          </div>
          <div>
            <label>Diesel (liters / yr)</label>
            <input type="number" value={energy.diesel_annual_liters ?? 0} onChange={e => setEnergy({ ...energy, diesel_annual_liters: Number(e.target.value || 0) })} />
          </div>
        </div>

        <div className="muted" style={{ marginTop: 6 }}>
          Estimated annual electricity cost:{' '}
          <strong>
            {(((energy.tariff_aed_per_kwh || 0) * (energy.annual_kwh || 0)).toLocaleString('en-AE', { maximumFractionDigits: 2 }))}{' '}
            د.إ
          </strong>
        </div>
      </div>

      {/* Targets / Constraints */}
      <div className="card">
        <h2>Targets & Constraints</h2>
        <div className="grid">
          <div className="col2">
            <label>Objectives / Notes</label>
            <textarea value={targets.objectives || ''} onChange={e => setTargets({ ...targets, objectives: e.target.value })} />
          </div>
          <div className="col2">
            <label>Constraints / Concerns</label>
            <textarea value={targets.constraints || ''} onChange={e => setTargets({ ...targets, constraints: e.target.value })} />
          </div>
          <div>
            <label>Budget (AED)</label>
            <input type="number" value={targets.budgetAED ?? 0} onChange={e => setTargets({ ...targets, budgetAED: Number(e.target.value || 0) })} />
          </div>
          <div>
            <label>Payback target (years)</label>
            <input type="number" step="0.1" value={targets.paybackTargetYears ?? 0} onChange={e => setTargets({ ...targets, paybackTargetYears: Number(e.target.value || 0) })} />
          </div>
        </div>
      </div>

      {/* Attachments */}
      <div className="card">
  <h2>Attachments (optional)</h2>
  <div className="muted" style={{ marginBottom: 8 }}>
    Paste uploaded S3 keys or file URLs (one per line). Examples:<br />
    <code>sess_123/asbuilt.pdf</code>, <code>https://…/singleline.pdf</code>
  </div>

  <textarea
    className="col2"
    rows={4}
    placeholder="One key or URL per line…"
    value={fileListRaw}
    onChange={e => setFileListRaw(e.target.value)}
  />

<div style={{ marginTop: 8 }}>
  <input
    type="file"
    multiple
    onChange={onPickFiles}
    disabled={!sessionId || uploading}
  />
  {uploading && <span className="muted" style={{ marginLeft: 8 }}>Uploading…</span>}
</div>

  {/* Visible file picker */}
  <div style={{ marginTop: 12 }}>
    <input
      type="file"
      multiple
      onChange={handleFileChange}
      disabled={uploadBusy}
    />
  </div>

  {/* Progress */}
  {Object.keys(uploadProgress).length > 0 && (
    <div style={{ marginTop: 10 }}>
      {Object.entries(uploadProgress).map(([name, pct]) => (
        <div key={name} style={{ margin: '6px 0' }}>
          <div style={{ fontSize: 12 }}>{name}</div>
          <div style={{ height: 6, background: '#eee', borderRadius: 4 }}>
            <div style={{ height: 6, width: `${pct}%`, borderRadius: 4, background: '#3b82f6' }} />
          </div>
        </div>
      ))}
    </div>
  )}

  {/* Status */}
  {uploadMsg && (
    <div role="status" aria-live="polite" className="muted" style={{ marginTop: 8 }}>
      {uploadMsg}
    </div>
  )}
</div>
      {/* Status */}
      {status.kind !== 'idle' && (
        <div className="card">
          <div className={`status ${status.kind === 'ok' ? 'ok' : 'err'}`}>{status.msg}</div>
        </div>
      )}

      {/* Results */}
      <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
        <h2>Audit Results</h2>
        {result?.ok && (
          <>
            <div className="results prose">
              <ReactMarkdown>{(result.analysis || '').trim() || 'Analysis text not returned.'}</ReactMarkdown>
            </div>
            <div className="watermark">Grüntek Energy Solutions</div>
          </>
        )}
        {result && !result.ok && (
          <div className="results error">
            Error: {result.error || `Request failed (status ${result.status ?? 'unknown'})`}
          </div>
        )}
        {!result && <div className="muted">Run analysis to see results here.</div>}
      </div>

      {/* Footer / disclaimer */}
      <div className="muted" style={{ margin: '10px 2px 40px' }}>
        <strong>Disclaimer:</strong> Results are generated from provided inputs and may include AI‑assisted analysis.
        Do not share with third parties. © Gruntek District Cooling Services Co LLC (Grüntek Energy Solutions).
      </div>

      {/* styles */}
      <style jsx>{`
        .container { max-width: 1050px; margin: 0 auto; padding: 18px; background: #fff; color: #111; }
        .row { display: flex; align-items: center; gap: 12px; }
        .header { justify-content: space-between; margin-bottom: 12px; }
        h1 { font-size: 22px; margin: 0 0 4px; }
        h2 { font-size: 18px; margin: 0 0 10px; }
        h3 { font-size: 15px; margin: 8px 0; color: #111; }
        .muted { color: #6b7280; font-size: 13px; }
        .btn { background: #0ea5e9; color: #fff; border: none; padding: 8px 14px; border-radius: 9px; font-weight: 600; cursor: pointer; }
        .btn.secondary { background: #e5e7eb; color: #111; }
        .btn:disabled { opacity: .5; cursor: not-allowed; }
        .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; margin: 10px 0; background: #fff; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
        .grid .col2 { grid-column: span 2; }
        input, select, textarea { width: 100%; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; background: #fff; color: #111; }
        label { display: block; font-size: 12px; color: #374151; margin-bottom: 4px; }
        .status { padding: 10px 12px; border-radius: 8px; font-weight: 600; }
        .status.ok { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
        .status.err { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        .error { color: #991b1b; }
        .prose :global(p) { margin: 0 0 12px; }
        .prose :global(li) { margin: 4px 0; }
        .watermark { position: absolute; inset: 0; pointer-events: none; opacity: .06; font-weight: 800; font-size: 46px; display: flex; align-items: center; justify-content: center; transform: rotate(-18deg); }
        code { background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }
      `}</style>
    </div>
  );
}