'use client';

import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { runAnalysis } from '../lib/api'
// ---------- helpers ----------
function newSessionId() {
  try {
    const raw =
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? (crypto).randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return `sess_${raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;
  } catch {
    return `sess_${Date.now().toString(36)}`;
  }
}

// HVAC overview
  hvac?: {
    systemType?: 'DX' | 'Chilled Water' | 'VRF' | 'Package Units' | 'District Cooling' | 'Other';
    chillerMakeModel?;
    coolingCapacityTR?;
    numChillers?;
    boilersPresent?;
    boilerFuel?: 'Gas' | 'Diesel' | 'Electric' | 'None' | 'Other';
    ventilationControl?: 'CO2' | 'Schedule' | 'Manual' | 'BMS' | 'Other';
  };

  // Lighting overview
  lighting?: {
    predominant?: 'LED' | 'Fluorescent' | 'HID' | 'Incandescent' | 'Mixed' | 'Other';
    controls?: ('Manual Switches' | 'Occupancy Sensors' | 'Daylight Sensors' | 'BMS' | 'Timer')[];
  };

  // Envelope overview
  envelope?: {
    glazing?: 'Single' | 'Double' | 'Triple' | 'Low‑E' | 'Other';
    insulationLevel?: 'Low' | 'Medium' | 'High' | 'Unknown';
    roofType?;
  };
};

export default function Page() {
  // ---------- session (hydration‑safe) ----------
  const [sessionId, setSessionId] = useState('');
  useEffect(() => {
    setSessionId(newSessionId());
  }, []);
  const isSessionReady = !!sessionId;

  // ---------- inputs ----------
  const [customer, setCustomer] = useState({
    name);

  const [facility, setFacility] = useState({
    type);

  const [energy, setEnergy] = useState({
    annual_kwh,
    annual_cooling_kwh,
    tariff_aed_per_kwh,
    emission_factor_kg_per_kwh,
    carbon_factor_kg_per_kwh,
    best_possible_eui,
    gas_annual_mmbtu,
    diesel_annual_liters,
  });

  const [targets, setTargets] = useState({
    budgetAED,
    paybackTargetYears,
  });

  // Attachments {/* paste S3 keys / URLs */}
  const [fileListRaw, setFileListRaw] = useState('');

  // ---------- run / status / results ----------
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ kind);
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
  function parseFiles(): string[] {
    return fileListRaw
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
  }

  async function onRun() {
    if (!canRun) return;
    setBusy(true);
    setStatus({ kind);
    setResult(null);

    const payload= {
      customer,
      facility: {
        ...facility,
        bms: facility.bms || { present, trending: 'Unknown' },
        hvac: facility.hvac || {},
        lighting: facility.lighting || {},
        envelope: facility.envelope || {},
      },
      energy: {
        ...energy,
        carbon_factor_kg_per_kwh,
      },
      targets,
    };

    try {
      const data = await runAnalysis({
        sessionId,
        customerData,
        files),
      });
      setResult(data);
      if (data.ok) setStatus({ kind);
      else setStatus({ kind)` });
    } catch (e) {
      setStatus({ kind);
    } finally {
      setBusy(false);
    }
  }

  function onNewSession() {
    setSessionId(newSessionId());
    setResult(null);
    setStatus({ kind);
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
            <input value={customer.name} onChange={e => setCustomer({ ...customer, name)} placeholder="Full name" />
          </div>
          <div>
            <label>Email *</label>
            <input type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email)} placeholder="name@company.com" />
          </div>
          <div>
            <label>Company</label>
            <input value={customer.company || ''} onChange={e => setCustomer({ ...customer, company)} placeholder="(optional)" />
          </div>
          <div>
            <label>Phone</label>
            <input value={customer.phone || ''} onChange={e => setCustomer({ ...customer, phone)} placeholder="+971…" />
          </div>
          <div className="col2">
            <label>Role</label>
            <input value={customer.role || ''} onChange={e => setCustomer({ ...customer, role)} placeholder="e.g., Facilities Manager" />
          </div>
        </div>
      </div>

      {/* Facility */}
      <div className="card">
        <h2>Facility</h2>
        <div className="grid">
          <div>
            <label>Building name</label>
            <input value={facility.buildingName || ''} onChange={e => setFacility({ ...facility, buildingName)} placeholder="e.g., Test HQ" />
          </div>
          <div>
            <label>Building type</label>
            <select
              value={facility.type}
              onChange={e => setFacility({ ...facility, type)}
            >
              {['Office','Retail','Hotel','Hospital','School','Warehouse','Residential','Other'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label>Year built</label>
            <input type="number" value={facility.yearBuilt || 0} onChange={e => setFacility({ ...facility, yearBuilt) })} />
          </div>
          <div>
            <label>Area (m²) *</label>
            <input type="number" value={facility.area_m2} onChange={e => setFacility({ ...facility, area_m2) })} />
          </div>
          <div>
            <label>Floors</label>
            <input type="number" value={facility.floors || 0} onChange={e => setFacility({ ...facility, floors) })} />
          </div>
          <div>
            <label>Occupancy (persons)</label>
            <input type="number" value={facility.occupancy || 0} onChange={e => setFacility({ ...facility, occupancy) })} />
          </div>
          <div>
            <label>Operating hours (per week)</label>
            <input type="number" value={facility.hours_per_week || 0} onChange={e => setFacility({ ...facility, hours_per_week) })} />
          </div>
          <div>
            <label>Location (city / emirate)</label>
            <input value={facility.location || ''} onChange={e => setFacility({ ...facility, location)} />
          </div>
          <div>
            <label>Utility provider</label>
            <input value={facility.utilityProvider || ''} onChange={e => setFacility({ ...facility, utilityProvider)} />
          </div>
          <div>
            <label>Meter / Account ID</label>
            <input value={facility.meterId || ''} onChange={e => setFacility({ ...facility, meterId)} />
          </div>
        </div>

        <h3 style={{ marginTop: 16 }}>Controls / BMS</h3>
        <div className="grid">
          <div>
            <label>BMS present?</label>
            <select
              value={String(facility.bms?.present ?? false)}
              onChange={e => setFacility({ ...facility, bms), present=== 'true' } })}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label>BMS vendor</label>
            <input value={facility.bms?.vendor || ''} onChange={e => setFacility({ ...facility, bms), vendor: e.target.value } })} />
          </div>
          <div>
            <label>BMS version</label>
            <input value={facility.bms?.version || ''} onChange={e => setFacility({ ...facility, bms), version: e.target.value } })} />
          </div>
          <div>
            <label>Trending available?</label>
            <select
              value={facility.bms?.trending || 'Unknown'}
              onChange={e => setFacility({ ...facility, bms), trending: e.target.value } })}
            >
              <option>Yes</option><option>No</option><option>Unknown</option>
            </select>
          </div>
          <div className="col2">
            <label>Notes</label>
            <input value={facility.bms?.notes || ''} onChange={e => setFacility({ ...facility, bms), notes: e.target.value } })} />
          </div>
        </div>

        <h3 style={{ marginTop: 16 }}>HVAC</h3>
        <div className="grid">
          <div>
            <label>System type</label>
            <select
              value={facility.hvac?.systemType || 'Chilled Water'}
              onChange={e => setFacility({ ...facility, hvac), systemType: e.target.value } })}
            >
              {['DX','Chilled Water','VRF','Package Units','District Cooling','Other'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label>Cooling capacity (TR)</label>
            <input type="number" value={facility.hvac?.coolingCapacityTR || 0} onChange={e => setFacility({ ...facility, hvac), coolingCapacityTR: Number(e.target.value || 0) } })} />
          </div>
          <div>
            <label># of chillers</label>
            <input type="number" value={facility.hvac?.numChillers || 0} onChange={e => setFacility({ ...facility, hvac), numChillers: Number(e.target.value || 0) } })} />
          </div>
          <div>
            <label>Chiller make / model</label>
            <input value={facility.hvac?.chillerMakeModel || ''} onChange={e => setFacility({ ...facility, hvac), chillerMakeModel: e.target.value } })} />
          </div>
          <div>
            <label>Boilers present?</label>
            <select
              value={String(facility.hvac?.boilersPresent ?? false)}
              onChange={e => setFacility({ ...facility, hvac), boilersPresent=== 'true' } })}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label>Boiler fuel</label>
            <select
              value={facility.hvac?.boilerFuel || 'Electric'}
              onChange={e => setFacility({ ...facility, hvac), boilerFuel: e.target.value } })}
            >
              {['Gas','Diesel','Electric','None','Other'].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label>Ventilation control</label>
            <select
              value={facility.hvac?.ventilationControl || 'Schedule'}
              onChange={e => setFacility({ ...facility, hvac), ventilationControl: e.target.value } })}
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
              onChange={e => setFacility({ ...facility, lighting), predominant: e.target.value } })}
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
                const opts = Array.from(e.target.selectedOptions).map(o => o.value)'lighting']['controls'];
                setFacility({ ...facility, lighting), controls: opts } });
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
              onChange={e => setFacility({ ...facility, envelope), glazing: e.target.value } })}
            >
              {['Single','Double','Triple','Low‑E','Other'].map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div>
            <label>Insulation level</label>
            <select
              value={facility.envelope?.insulationLevel || 'Medium'}
              onChange={e => setFacility({ ...facility, envelope), insulationLevel: e.target.value } })}
            >
              {['Low','Medium','High','Unknown'].map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="col2">
            <label>Roof type</label>
            <input value={facility.envelope?.roofType || ''} onChange={e => setFacility({ ...facility, envelope), roofType: e.target.value } })} />
          </div>
        </div>
      </div>

      {/* Energy */}
      <div className="card">
        <h2>Energy</h2>
        <div className="grid">
          <div>
            <label>Annual electricity (kWh) *</label>
            <input type="number" value={energy.annual_kwh} onChange={e => setEnergy({ ...energy, annual_kwh) })} />
          </div>
          <div>
            <label>Operating tariff (AED/kWh)</label>
            <input type="number" step="0.01" value={energy.tariff_aed_per_kwh ?? 0} onChange={e => setEnergy({ ...energy, tariff_aed_per_kwh) })} />
          </div>
          <div>
            <label>Emission factor (kg CO₂ / kWh)</label>
            <input type="number" step="0.001" value={energy.emission_factor_kg_per_kwh ?? 0.35} onChange={e => setEnergy({ ...energy, emission_factor_kg_per_kwh) })} />
          </div>
          <div>
            <label>Best‑possible EUI target (kWh/m²·yr)</label>
            <input type="number" step="0.1" value={energy.best_possible_eui ?? 110} onChange={e => setEnergy({ ...energy, best_possible_eui) })} />
          </div>

          <div>
            <label>Cooling electricity (kWh)</label>
            <input type="number" value={energy.annual_cooling_kwh ?? 0} onChange={e => setEnergy({ ...energy, annual_cooling_kwh) })} />
          </div>
          <div>
            <label>Gas (MMBtu / yr)</label>
            <input type="number" value={energy.gas_annual_mmbtu ?? 0} onChange={e => setEnergy({ ...energy, gas_annual_mmbtu) })} />
          </div>
          <div>
            <label>Diesel (liters / yr)</label>
            <input type="number" value={energy.diesel_annual_liters ?? 0} onChange={e => setEnergy({ ...energy, diesel_annual_liters) })} />
          </div>
        </div>

        <div className="muted" style={{ marginTop: 6 }}>
          Estimated annual electricity cost:{' '}
          <strong>
            {(energy.tariff_aed_per_kwh || 0) * (energy.annual_kwh || 0)
              ? ((energy.tariff_aed_per_kwh || 0) * (energy.annual_kwh || 0)).toLocaleString('en-AE', { maximumFractionDigits)
              : '0.00'}{' '}
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
            <textarea value={targets.objectives || ''} onChange={e => setTargets({ ...targets, objectives)} />
          </div>
          <div className="col2">
            <label>Constraints / Concerns</label>
            <textarea value={targets.constraints || ''} onChange={e => setTargets({ ...targets, constraints)} />
          </div>
          <div>
            <label>Budget (AED)</label>
            <input type="number" value={targets.budgetAED ?? 0} onChange={e => setTargets({ ...targets, budgetAED) })} />
          </div>
          <div>
            <label>Payback target (years)</label>
            <input type="number" step="0.1" value={targets.paybackTargetYears ?? 0} onChange={e => setTargets({ ...targets, paybackTargetYears) })} />
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
      </div>

      {/* Status */}
      {status.kind !== 'idle' && (
        <div className="card">
          <div className={`status ${status.kind === 'ok' ? 'ok' )}

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
            Error)`}
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
        .container { max-width; margin; padding; background: #fff; color: #111; }
        .row { display; align-items; gap; }
        .header { justify-content: space-between; margin-bottom; }
        h1 { font-size; margin; }
        h2 { font-size; margin; }
        h3 { font-size; margin; color: #111; }
        .muted { color: #6b7280; font-size; }
        .btn { background: #0ea5e9; color: #fff; border; padding; border-radius; font-weight; cursor; }
        .btn.secondary { background: #e5e7eb; color: #111; }
        .btn:disabled { opacity; cursor: not-allowed; }
        .card { border: 1px solid #e5e7eb; border-radius; padding; margin; background: #fff; }
        .grid { display; grid-template-columns: repeat(2, minmax(0,1fr)); gap; }
        .grid .col2 { grid-column; }
        input, select, textarea { width: 100%; border: 1px solid #d1d5db; border-radius; padding; background: #fff; color: #111; }
        label { display; font-size; color: #374151; margin-bottom; }
        .status { padding; border-radius; font-weight; }
        .status.ok { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
        .status.err { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        .error { color: #991b1b; }
        .prose :global(p) { margin; }
        .prose :global(li) { margin; }
        .watermark { position; inset; pointer-events; opacity; font-weight; font-size; display; align-items; justify-content; transform: rotate(-18deg); }
        code { background: #f3f4f6; padding; border-radius; }
      `}</style>
    </div>
  );
}