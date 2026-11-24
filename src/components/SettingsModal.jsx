import React, { useState } from 'react';
import {
  Database,
  Download,
  Edit3,
  Flame,
  Moon,
  Package,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Sun,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { formatWeightDual } from '../utils/grams.js';
import { formatCOP } from '../utils/money.js';

export default function SettingsModal({
  isOpen,
  onClose,
  state,
  hasLegacyData,
  onSetTheme,
  onUpdateCatalogItem,
  onAddCatalogItem,
  onDeleteCatalogItem,
  onUpdateSupplies,
  onUpdateOpeningInventory,
  onRecalculateInventory,
  onSaveClient,
  onDeleteClient,
  onSaveProducer,
  onDeleteProducer,
  onExportV8,
  onExportLegacy,
  onImportJson,
  onRecoverDirectory,
  onRestoreAutoBackup,
  onCopyTextBackup,
  onImportTextBackup,
}) {
  const {
    theme,
    catalog,
    supplies,
    clients,
    producers,
    sales,
    openingInventoryGrams,
    inventoryGrams,
  } = state;

  const [editingCatId, setEditingCatId] = useState(null);
  const [catDraft, setCatDraft] = useState({ priceCop: '', grams: '', packType: 'especial' });

  const [showNewCatalog, setShowNewCatalog] = useState(false);
  const [newCatalog, setNewCatalog] = useState({
    name: '',
    grams: '200',
    priceCop: '15000',
    packType: 'especial',
  });

  const [filterClient, setFilterClient] = useState('');
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientDraft, setClientDraft] = useState({ fullName: '', business: '', sector: '', phone: '' });

  const [filterProducer, setFilterProducer] = useState('');
  const [showProducerForm, setShowProducerForm] = useState(false);
  const [producerDraft, setProducerDraft] = useState({ name: '', finca: '', sector: '', phone: '' });
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteBackupText, setPasteBackupText] = useState('');

  if (!isOpen) return null;

  const handleSaveCatalogEdit = (id) => {
    onUpdateCatalogItem(id, {
      priceCop: parseInt(catDraft.priceCop, 10) || 0,
      grams: parseInt(catDraft.grams, 10) || 200,
      packType: catDraft.packType,
      hasLabel: catDraft.packType === 'especial',
    });
    setEditingCatId(null);
  };

  const handleAddCatalogSubmit = (e) => {
    e.preventDefault();
    if (!newCatalog.name.trim()) return;
    onAddCatalogItem({
      name: newCatalog.name.trim(),
      grams: parseInt(newCatalog.grams, 10) || 200,
      priceCop: parseInt(newCatalog.priceCop, 10) || 0,
      packType: newCatalog.packType,
      hasLabel: newCatalog.packType === 'especial',
    });
    setNewCatalog({ name: '', grams: '200', priceCop: '15000', packType: 'especial' });
    setShowNewCatalog(false);
  };

  const handleClientSubmit = (e) => {
    e.preventDefault();
    if (!clientDraft.fullName.trim()) return;
    onSaveClient(clientDraft);
    setClientDraft({ fullName: '', business: '', sector: '', phone: '' });
    setShowClientForm(false);
  };

  const handleProducerSubmit = (e) => {
    e.preventDefault();
    if (!producerDraft.name.trim()) return;
    onSaveProducer(producerDraft);
    setProducerDraft({ name: '', finca: '', sector: '', phone: '' });
    setShowProducerForm(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto p-4 pb-20 animate-in fade-in">
      <div className="max-w-md mx-auto theme-app rounded-2xl p-4 space-y-5 shadow-2xl border theme-border">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-black tracking-wider flex items-center gap-2">
            <Settings size={18} className="theme-accent-text" /> CONFIGURACIÓN V8.0
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="theme-card p-2 rounded-full"
          >
            <X size={18} />
          </button>
        </div>

        {/* Apariencia */}
        <div className="theme-card p-4 rounded-2xl space-y-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider theme-accent-text">
            Apariencia Visual
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSetTheme('light')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border ${
                theme === 'light' ? 'theme-accent-bg border-transparent' : 'theme-subtle theme-muted'
              }`}
            >
              <Sun size={15} /> Claro Cálido
            </button>
            <button
              type="button"
              onClick={() => onSetTheme('dark')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border ${
                theme === 'dark' ? 'theme-accent-bg border-transparent' : 'theme-subtle theme-muted'
              }`}
            >
              <Moon size={15} /> Modo Oscuro
            </button>
          </div>
        </div>

        {/* Respaldos y Migración */}
        <div className="theme-card p-4 rounded-2xl space-y-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 theme-accent-text">
            <Database size={15} /> Respaldo Offline y Actualización Segura
          </h3>
          <p className="text-[11px] theme-muted">
            La app guarda automáticamente una copia en Documentos (<b>Colados_AutoRespaldo_V8.json</b>) en cada cambio, y desde V8.1 las nuevas versiones APK se instalan encima sin desinstalar.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onExportV8}
              className="theme-subtle py-2.5 px-3 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5"
            >
              <Download size={14} /> EXPORTAR JSON
            </button>
            <label className="theme-accent-bg py-2.5 px-3 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer">
              <Save size={14} /> IMPORTAR JSON
              <input type="file" accept=".json" className="hidden" onChange={onImportJson} />
            </label>
          </div>
          {onRestoreAutoBackup && (
            <button
              type="button"
              onClick={onRestoreAutoBackup}
              className="w-full theme-info-soft py-2.5 px-3 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5"
            >
              <RotateCcw size={14} /> RESTAURAR AUTO-RESPALDO DE DOCUMENTOS
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            {onCopyTextBackup && (
              <button
                type="button"
                onClick={onCopyTextBackup}
                className="theme-subtle py-2 px-2.5 rounded-xl text-[10px] font-black"
              >
                📋 COPIAR COMO TEXTO
              </button>
            )}
            {onImportTextBackup && (
              <button
                type="button"
                onClick={() => setShowPasteBox((v) => !v)}
                className="theme-subtle py-2 px-2.5 rounded-xl text-[10px] font-black"
              >
                📥 PEGAR RESPALDO TEXTO
              </button>
            )}
          </div>
          {showPasteBox && onImportTextBackup && (
            <div className="theme-subtle p-2.5 rounded-xl space-y-2">
              <textarea
                rows={3}
                placeholder="Pega aquí el texto JSON copiado..."
                value={pasteBackupText}
                onChange={(e) => setPasteBackupText(e.target.value)}
                className="w-full p-2 rounded-lg theme-input text-[11px] font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  if (onImportTextBackup(pasteBackupText)) {
                    setPasteBackupText('');
                    setShowPasteBox(false);
                  }
                }}
                className="w-full theme-accent-bg py-2 rounded-lg text-xs font-black"
              >
                RESTAURAR DESDE TEXTO PEGADO
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onRecoverDirectory}
            className="w-full theme-success-soft py-2.5 px-3 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5"
          >
            <RotateCcw size={14} /> RECUPERAR CLIENTES/PRODUCTORES (MEMORIA / DOCUMENTOS)
          </button>
          {hasLegacyData && (
            <button
              type="button"
              onClick={onExportLegacy}
              className="w-full theme-info-soft py-2 rounded-xl text-[11px] font-black"
            >
              Descargar Copia Histórica Anterior (v6/v7)
            </button>
          )}
        </div>

        {/* Inventario Inicial / Sobrantes en Gramos */}
        <div className="theme-card p-4 rounded-2xl space-y-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 theme-accent-text">
            <Package size={15} /> Inventario Inicial / Sobrantes (Gramos)
          </h3>
          <p className="text-[10px] theme-muted">
            Actual: Pergamino {formatWeightDual(inventoryGrams?.pergamino || 0)} · Azul{' '}
            {formatWeightDual(inventoryGrams?.azul || 0)} · Tostado {formatWeightDual(inventoryGrams?.tostado || 0)}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'pergamino', label: 'Pergamino (g)' },
              { key: 'azul', label: 'Azul (g)' },
              { key: 'tostado', label: 'Tostado (g)' },
            ].map((f) => (
              <div key={f.key} className="theme-subtle p-2 rounded-xl text-center">
                <label className="text-[9px] font-bold uppercase theme-muted block">{f.label}</label>
                <input
                  type="number"
                  min="0"
                  value={openingInventoryGrams?.[f.key] ?? 0}
                  onChange={(e) =>
                    onUpdateOpeningInventory({
                      ...openingInventoryGrams,
                      [f.key]: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  className="w-full bg-transparent text-center font-black text-sm mt-1 outline-none"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onRecalculateInventory}
            className="w-full theme-info-soft py-2.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5"
          >
            <RotateCcw size={14} /> RECALCULAR INVENTARIO EXACTO (GRAMOS)
          </button>
        </div>

        {/* Catálogo de Presentaciones */}
        <div className="theme-card p-4 rounded-2xl space-y-2.5">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black uppercase tracking-wider theme-accent-text">
              Precios y Presentaciones (COP)
            </h3>
            <button
              type="button"
              onClick={() => setShowNewCatalog((v) => !v)}
              className="text-[11px] font-black theme-accent-soft px-2 py-1 rounded-lg"
            >
              + Nueva
            </button>
          </div>

          {showNewCatalog && (
            <form onSubmit={handleAddCatalogSubmit} className="theme-subtle p-3 rounded-xl space-y-2">
              <input
                type="text"
                placeholder="Nombre (ej. 340g Bolsa Especial)"
                value={newCatalog.name}
                onChange={(e) => setNewCatalog({ ...newCatalog, name: e.target.value })}
                className="w-full p-2 rounded-lg theme-input text-xs"
                required
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="Gramos"
                  value={newCatalog.grams}
                  onChange={(e) => setNewCatalog({ ...newCatalog, grams: e.target.value })}
                  className="p-2 rounded-lg theme-input text-xs font-bold"
                  required
                />
                <input
                  type="number"
                  placeholder="Precio COP"
                  value={newCatalog.priceCop}
                  onChange={(e) => setNewCatalog({ ...newCatalog, priceCop: e.target.value })}
                  className="p-2 rounded-lg theme-input text-xs font-bold"
                  required
                />
                <select
                  value={newCatalog.packType}
                  onChange={(e) => setNewCatalog({ ...newCatalog, packType: e.target.value })}
                  className="p-2 rounded-lg theme-input text-xs font-bold"
                >
                  <option value="especial">Especial</option>
                  <option value="transparente">Transparente</option>
                </select>
              </div>
              <button type="submit" className="w-full theme-accent-bg py-2 rounded-lg text-xs font-black">
                Agregar Presentación
              </button>
            </form>
          )}

          <div className="divide-y theme-border">
            {catalog.map((p) => (
              <div key={p.id} className="py-2 flex justify-between items-center gap-2">
                {editingCatId === p.id ? (
                  <div className="w-full space-y-1.5">
                    <p className="text-xs font-bold">{p.name}</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      <input
                        type="number"
                        value={catDraft.grams}
                        onChange={(e) => setCatDraft({ ...catDraft, grams: e.target.value })}
                        className="p-1.5 rounded theme-input text-xs font-bold"
                      />
                      <input
                        type="number"
                        value={catDraft.priceCop}
                        onChange={(e) => setCatDraft({ ...catDraft, priceCop: e.target.value })}
                        className="p-1.5 rounded theme-input text-xs font-bold"
                      />
                      <select
                        value={catDraft.packType}
                        onChange={(e) => setCatDraft({ ...catDraft, packType: e.target.value })}
                        className="p-1.5 rounded theme-input text-xs font-bold"
                      >
                        <option value="especial">Especial</option>
                        <option value="transparente">Transp.</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingCatId(null)}
                        className="flex-1 theme-subtle py-1 rounded text-[11px] font-bold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveCatalogEdit(p.id)}
                        className="flex-1 theme-accent-bg py-1 rounded text-[11px] font-black"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-extrabold">{p.name}</p>
                      <p className="text-[10px] theme-muted">
                        {p.grams}g · {p.packType === 'especial' ? 'Bolsa Especial' : 'Transparente'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black">{formatCOP(p.priceCop)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCatId(p.id);
                          setCatDraft({
                            priceCop: String(p.priceCop),
                            grams: String(p.grams),
                            packType: p.packType,
                          });
                        }}
                        className="theme-muted hover:text-amber-500 p-1"
                      >
                        <Edit3 size={14} />
                      </button>
                      {catalog.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteCatalogItem(p.id)}
                          className="theme-muted hover:text-red-500 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Inventario de Insumos UNIFICADO */}
        <div className="theme-card p-4 rounded-2xl space-y-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider theme-accent-text flex items-center gap-1.5">
            <Package size={15} /> Inventario de Insumos
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'bolsas_especiales', label: 'Bolsas Especiales' },
              { key: 'bolsas_transparentes', label: 'Bolsas Transp./Granel' },
              { key: 'etiquetas', label: 'Etiquetas' },
              { key: 'stickers_grandes', label: 'Stickers G' },
              { key: 'stickers_pequenos', label: 'Stickers P' },
              { key: 'alerta_umbral', label: 'Umbral Alerta' },
            ].map((field) => (
              <div key={field.key} className="theme-subtle p-2.5 rounded-xl">
                <label className="text-[9px] font-bold uppercase theme-muted block">
                  {field.label}
                </label>
                <input
                  type="number"
                  min="0"
                  value={supplies?.[field.key] ?? 0}
                  onChange={(e) =>
                    onUpdateSupplies({
                      ...supplies,
                      [field.key]: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  className="w-full bg-transparent font-black text-base outline-none mt-0.5"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Clientes */}
        <div className="theme-card p-4 rounded-2xl space-y-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 theme-accent-text">
            <UserCheck size={15} /> Clientes ({clients.length})
          </h3>
          {!showClientForm ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setClientDraft({ fullName: '', business: '', sector: '', phone: '' });
                  setShowClientForm(true);
                }}
                className="w-full theme-accent-soft py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5"
              >
                <Plus size={14} /> NUEVO CLIENTE
              </button>
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="w-full p-2.5 rounded-xl theme-input text-xs"
              />
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {clients.length === 0 ? (
                  <p className="text-xs theme-muted">Sin clientes registrados.</p>
                ) : (
                  clients
                    .filter(
                      (c) =>
                        c.fullName.toLowerCase().includes(filterClient.toLowerCase()) ||
                        (c.business && c.business.toLowerCase().includes(filterClient.toLowerCase()))
                    )
                    .sort((a, b) => a.fullName.localeCompare(b.fullName))
                    .map((c) => {
                      const totalBought = sales
                        .filter((s) => !s.isDonation && (s.clientName || '').toLowerCase() === c.fullName.toLowerCase())
                        .reduce((sum, s) => sum + (s.cop || 0), 0);
                      return (
                        <div
                          key={c.id}
                          className="theme-subtle p-2.5 rounded-xl flex justify-between items-center gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold truncate">{c.fullName}</p>
                            <p className="text-[10px] theme-muted truncate">
                              {c.business && `${c.business} · `}{c.sector} {c.phone && `· ${c.phone}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] font-black theme-success-text">
                              {formatCOP(totalBought)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setClientDraft(c);
                                setShowClientForm(true);
                              }}
                              className="theme-muted hover:text-amber-500 p-1"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteClient(c.id)}
                              className="theme-muted hover:text-red-500 p-1"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleClientSubmit} className="space-y-2">
              <input
                type="text"
                placeholder="Nombre *"
                required
                value={clientDraft.fullName}
                onChange={(e) => setClientDraft({ ...clientDraft, fullName: e.target.value })}
                className="w-full p-2.5 rounded-xl theme-input text-xs"
              />
              <input
                type="text"
                placeholder="Empresa / Local"
                value={clientDraft.business}
                onChange={(e) => setClientDraft({ ...clientDraft, business: e.target.value })}
                className="w-full p-2.5 rounded-xl theme-input text-xs"
              />
              <input
                type="text"
                placeholder="Sector *"
                required
                value={clientDraft.sector}
                onChange={(e) => setClientDraft({ ...clientDraft, sector: e.target.value })}
                className="w-full p-2.5 rounded-xl theme-input text-xs"
              />
              <input
                type="text"
                placeholder="Teléfono"
                value={clientDraft.phone}
                onChange={(e) => setClientDraft({ ...clientDraft, phone: e.target.value })}
                className="w-full p-2.5 rounded-xl theme-input text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowClientForm(false)}
                  className="flex-1 theme-subtle py-2.5 rounded-xl text-xs font-bold"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="flex-1 theme-accent-bg py-2.5 rounded-xl text-xs font-black"
                >
                  GUARDAR
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Productores */}
        <div className="theme-card p-4 rounded-2xl space-y-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 theme-accent-text">
            <Flame size={15} /> Productores ({producers.length})
          </h3>
          {!showProducerForm ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setProducerDraft({ name: '', finca: '', sector: '', phone: '' });
                  setShowProducerForm(true);
                }}
                className="w-full theme-accent-soft py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5"
              >
                <Plus size={14} /> NUEVO PRODUCTOR
              </button>
              <input
                type="text"
                placeholder="Buscar productor..."
                value={filterProducer}
                onChange={(e) => setFilterProducer(e.target.value)}
                className="w-full p-2.5 rounded-xl theme-input text-xs"
              />
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {producers.length === 0 ? (
                  <p className="text-xs theme-muted">Sin productores registrados.</p>
                ) : (
                  producers
                    .filter(
                      (p) =>
                        p.name.toLowerCase().includes(filterProducer.toLowerCase()) ||
                        (p.finca && p.finca.toLowerCase().includes(filterProducer.toLowerCase())) ||
                        (p.sector && p.sector.toLowerCase().includes(filterProducer.toLowerCase()))
                    )
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((p) => (
                      <div
                        key={p.id}
                        className="theme-subtle p-2.5 rounded-xl flex justify-between items-center gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold truncate">{p.name}</p>
                          <p className="text-[10px] theme-muted truncate">
                            {p.finca} {p.sector && `· ${p.sector}`} {p.phone && `· ${p.phone}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setProducerDraft(p);
                              setShowProducerForm(true);
                            }}
                            className="theme-muted hover:text-amber-500 p-1"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProducer(p.id)}
                            className="theme-muted hover:text-red-500 p-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleProducerSubmit} className="space-y-2">
              <input
                type="text"
                placeholder="Nombre *"
                required
                value={producerDraft.name}
                onChange={(e) => setProducerDraft({ ...producerDraft, name: e.target.value })}
                className="w-full p-2.5 rounded-xl theme-input text-xs"
              />
              <input
                type="text"
                placeholder="Finca / Hacienda"
                value={producerDraft.finca}
                onChange={(e) => setProducerDraft({ ...producerDraft, finca: e.target.value })}
                className="w-full p-2.5 rounded-xl theme-input text-xs"
              />
              <input
                type="text"
                placeholder="Sector *"
                required
                value={producerDraft.sector}
                onChange={(e) => setProducerDraft({ ...producerDraft, sector: e.target.value })}
                className="w-full p-2.5 rounded-xl theme-input text-xs"
              />
              <input
                type="text"
                placeholder="Teléfono"
                value={producerDraft.phone}
                onChange={(e) => setProducerDraft({ ...producerDraft, phone: e.target.value })}
                className="w-full p-2.5 rounded-xl theme-input text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowProducerForm(false)}
                  className="flex-1 theme-subtle py-2.5 rounded-xl text-xs font-bold"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="flex-1 theme-accent-bg py-2.5 rounded-xl text-xs font-black"
                >
                  GUARDAR
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
