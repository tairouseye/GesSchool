import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";
import Cachet from "@/composants/Cachet.jsx";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";
import * as api from "@/lib/rh.js";
import { MODES } from "@/lib/paiements.js";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const moisCourant = () => new Date().toISOString().slice(0, 7); // YYYY-MM
const libellePeriode = (p) => {
  if (!p) return "";
  const [a, m] = p.split("-");
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${mois[Number(m) - 1] || ""} ${a}`;
};

export default function RH() {
  const { ecoleId, ecole } = useAuth();
  const confirmer = useConfirm();
  const toast = useToast();
  const devise = ecole?.devise || "XOF";
  const [onglet, setOnglet] = useState("personnel");
  const [personnels, setPersonnels] = useState([]);
  const [contrats, setContrats] = useState({});
  const [periode, setPeriode] = useState(moisCourant());
  const [salaires, setSalaires] = useState([]);
  const [erreur, setErreur] = useState("");
  const [modalePers, setModalePers] = useState(false);
  const [bulletin, setBulletin] = useState(null);

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const [pers, con] = await Promise.all([api.getPersonnels(ecoleId), api.getContratsActifs(ecoleId)]);
      setPersonnels(pers);
      setContrats(con);
    } catch (e) {
      setErreur(e.message);
    }
  }, [ecoleId]);

  const rechargerPaie = useCallback(async () => {
    try {
      setSalaires(await api.getSalaires(ecoleId, periode));
    } catch (e) {
      setErreur(e.message);
    }
  }, [ecoleId, periode]);

  useEffect(() => { recharger(); }, [recharger]);
  useEffect(() => { rechargerPaie(); }, [rechargerPaie]);

  const wrap = async (fn, apresPaie = false, msg) => {
    try {
      await fn();
      await recharger();
      if (apresPaie) await rechargerPaie();
      if (msg) toast.succes(msg);
      return true;
    } catch (e) {
      toast.erreur(e.message || "Une erreur est survenue.");
      return false;
    }
  };

  const action = onglet === "personnel"
    ? <Bouton onClick={() => setModalePers(true)}>+ Personnel</Bouton>
    : <Bouton onClick={() => wrap(async () => { await api.genererPaie(ecoleId, periode); }, true)} disabled={personnels.length === 0}>⚡ Générer la paie</Bouton>;

  // Tableau de bord RH (accueil de l'espace) — agrégé depuis les données chargées
  const jour = new Date().toISOString().slice(0, 10);
  const dans60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  const masseMois = salaires.reduce((s, x) => s + Number(x.montant_net || 0), 0);
  const payeMois = salaires.filter((s) => s.paye).reduce((s, x) => s + Number(x.montant_net || 0), 0);
  const restantMois = masseMois - payeMois;
  const aPayer = salaires.filter((s) => !s.paye).length;
  const fichesAgenerer = Math.max(0, personnels.length - salaires.length);
  const fonctions = Object.entries(
    personnels.reduce((acc, p) => { const f = p.fonction || "—"; acc[f] = (acc[f] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]);
  const maxFonction = Math.max(1, ...fonctions.map(([, v]) => v));
  const echeances = personnels
    .map((p) => ({ p, c: contrats[p.id] }))
    .filter((x) => x.c?.fin && x.c.fin >= jour && x.c.fin <= dans60)
    .map((x) => ({ nom: `${x.p.prenom} ${x.p.nom}`, fin: x.c.fin, type: x.c.type }))
    .sort((a, b) => (a.fin || "").localeCompare(b.fin || ""));

  return (
    <>
      <EnTete titre="RH & paie" sousTitre="Personnel, contrats et salaires" action={action} />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {/* À traiter */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <AlerteRH onClick={() => setOnglet("paie")} label="Salaires à payer" valeur={aPayer}
            sous={`${fmt(restantMois)} ${devise} restants`} actif={aPayer > 0} ton="or" />
          <AlerteRH onClick={() => setOnglet("paie")} label="Fiches à générer" valeur={fichesAgenerer}
            sous={`paie ${libellePeriode(periode)}`} actif={fichesAgenerer > 0} ton="navy" />
          <AlerteRH onClick={() => setOnglet("personnel")} label="Contrats à échéance" valeur={echeances.length}
            sous="dans les 60 jours" actif={echeances.length > 0} ton="rouge" />
        </div>

        {/* Indicateurs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SyntheseCarte label="Personnel" valeur={String(personnels.length)} ton="or" />
          <SyntheseCarte label={`Masse salariale (${libellePeriode(periode)})`} valeur={`${fmt(masseMois)} ${devise}`} />
          <SyntheseCarte label="Payé ce mois" valeur={`${fmt(payeMois)} ${devise}`} ton="vert" />
          <SyntheseCarte label="Restant à payer" valeur={`${fmt(restantMois)} ${devise}`} ton="rouge" />
        </div>

        {/* Répartition par fonction + contrats à échéance */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Carte className="p-6">
            <h3 className="mb-4 font-display text-lg font-semibold text-navy-900">Répartition par fonction</h3>
            {fonctions.length === 0 ? (
              <p className="text-sm text-navy-900/40">Aucun personnel enregistré.</p>
            ) : (
              <ul className="space-y-3">
                {fonctions.map(([f, v]) => (
                  <li key={f} className="flex items-center gap-4">
                    <span className="w-32 shrink-0 truncate text-sm font-medium text-navy-900">{f}</span>
                    <div className="flex-1">
                      <div className="h-2.5 overflow-hidden rounded-full bg-navy-900/10">
                        <div className="h-full bg-navy-900/80" style={{ width: `${(v / maxFonction) * 100}%` }} />
                      </div>
                    </div>
                    <span className="w-8 shrink-0 text-right font-mono text-sm text-navy-900/60">{v}</span>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
          <Carte className="p-6">
            <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">Contrats à échéance (60 j)</h3>
            {echeances.length === 0 ? (
              <p className="text-sm text-navy-900/40">Aucun contrat n'arrive à échéance 🎉</p>
            ) : (
              <ul className="divide-y divide-navy-900/5">
                {echeances.map((e, i) => (
                  <li key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium text-navy-900">{e.nom}</span>
                    <span className="text-navy-900/50">{e.type || "—"}</span>
                    <span className="font-mono text-xs text-rose-600">{new Date(e.fin).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>

        <div className="inline-flex gap-1 rounded-xl bg-navy-900/5 p-1">
          {[["personnel", "Personnel"], ["paie", "Paie"]].map(([k, l]) => (
            <button key={k} onClick={() => setOnglet(k)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${onglet === k ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/50"}`}>
              {l}
            </button>
          ))}
        </div>

        {onglet === "personnel" ? (
          <PanneauPersonnel
            personnels={personnels} contrats={contrats} devise={devise}
            onSuppr={async (id) => { if (await confirmer("Supprimer ce membre du personnel ?")) wrap(() => api.supprimerPersonnel(id), false, "Personnel supprimé."); }}
          />
        ) : (
          <PanneauPaie
            periode={periode} setPeriode={setPeriode} salaires={salaires} devise={devise}
            onMaj={(id, v) => wrap(() => api.majSalaire(id, v), true)}
            onPayer={(id, v) => wrap(() => api.marquerPaye(id, v), true)}
            onAnnuler={(id) => wrap(() => api.annulerPaiement(id), true)}
            onSuppr={(id) => wrap(() => api.supprimerSalaire(id), true)}
            onBulletin={(s) => setBulletin(s)}
          />
        )}
      </div>

      <ModalePersonnel
        ouvert={modalePers} onFermer={() => setModalePers(false)}
        onCreer={(p, c) => wrap(async () => {
          const pers = await api.creerPersonnel(ecoleId, p);
          if (c.salaire_base) await api.creerContrat(ecoleId, { ...c, personnel_id: pers.id });
          setModalePers(false);
        })}
      />

      <ModaleBulletin bulletin={bulletin} onFermer={() => setBulletin(null)} ecole={ecole} devise={devise} />
    </>
  );
}

function PanneauPersonnel({ personnels, contrats, devise, onSuppr }) {
  if (personnels.length === 0) {
    return <Carte className="p-8 text-sm text-navy-900/50">Aucun personnel. Ajoute ton équipe avec « + Personnel ».</Carte>;
  }
  return (
    <Carte className="overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-creme text-navy-900/50">
          <tr>
            <th className="px-6 py-3 font-medium">Nom</th>
            <th className="px-6 py-3 font-medium">Fonction</th>
            <th className="px-6 py-3 font-medium">Contact</th>
            <th className="px-6 py-3 font-medium">Contrat</th>
            <th className="px-6 py-3 text-right font-medium">Salaire base</th>
            <th className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {personnels.map((p) => {
            const c = contrats[p.id];
            return (
              <tr key={p.id} className="border-t border-navy-900/5">
                <td className="px-6 py-3 font-medium text-navy-900">{p.prenom} {p.nom}</td>
                <td className="px-6 py-3 text-navy-900/70">{p.fonction || "—"}</td>
                <td className="px-6 py-3 text-navy-900/60">{p.telephone || p.email || "—"}</td>
                <td className="px-6 py-3 text-navy-900/60">{c?.type || "—"}</td>
                <td className="px-6 py-3 text-right font-mono">{c ? `${fmt(c.salaire_base)} ${devise}` : "—"}</td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => onSuppr(p.id)} className="text-xs text-rose-500 hover:underline">suppr.</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Carte>
  );
}

function PanneauPaie({ periode, setPeriode, salaires, devise, onMaj, onPayer, onAnnuler, onSuppr, onBulletin }) {
  const totalNet = salaires.reduce((s, x) => s + Number(x.montant_net || 0), 0);
  const totalPaye = salaires.filter((s) => s.paye).reduce((s, x) => s + Number(x.montant_net || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-900/50">Période</span>
          <input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)}
            className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500" />
        </label>
        <div className="flex gap-4 text-sm">
          <span className="text-navy-900/50">Masse salariale : <b className="font-mono text-navy-900">{fmt(totalNet)} {devise}</b></span>
          <span className="text-emerald-700">Payé : <b className="font-mono">{fmt(totalPaye)} {devise}</b></span>
        </div>
      </div>
      <p className="text-xs text-navy-900/40">
        💡 « Payer » crée automatiquement une dépense en comptabilité (catégorie Salaires) ; « annuler » la retire.
      </p>

      {salaires.length === 0 ? (
        <Carte className="p-8 text-sm text-navy-900/50">
          Aucune fiche de paie pour {libellePeriode(periode)}. Clique « ⚡ Générer la paie ».
        </Carte>
      ) : (
        <Carte className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-creme text-navy-900/50">
              <tr>
                <th className="px-4 py-3 font-medium">Personnel</th>
                <th className="px-4 py-3 text-right font-medium">Brut</th>
                <th className="px-4 py-3 text-right font-medium">Prime</th>
                <th className="px-4 py-3 text-right font-medium">Retenue</th>
                <th className="px-4 py-3 text-right font-medium">Net</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {salaires.map((s) => (
                <LignePaie key={s.id} s={s} devise={devise}
                  onMaj={onMaj} onPayer={onPayer} onAnnuler={onAnnuler} onSuppr={onSuppr} onBulletin={onBulletin} />
              ))}
            </tbody>
          </table>
        </Carte>
      )}
    </div>
  );
}

function LignePaie({ s, devise, onMaj, onPayer, onAnnuler, onSuppr, onBulletin }) {
  const [brut, setBrut] = useState(String(s.montant_brut ?? 0));
  const [prime, setPrime] = useState(String(s.prime ?? 0));
  const [retenue, setRetenue] = useState(String(s.retenue ?? 0));
  const net = (Number(brut) || 0) + (Number(prime) || 0) - (Number(retenue) || 0);
  const champNum = "w-24 rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-right font-mono text-sm outline-none focus:border-or-500 disabled:bg-navy-900/5";

  const commit = () => {
    if (Number(brut) !== Number(s.montant_brut) || Number(prime) !== Number(s.prime) || Number(retenue) !== Number(s.retenue)) {
      onMaj(s.id, { montant_brut: brut, prime, retenue });
    }
  };

  return (
    <tr className="border-t border-navy-900/5">
      <td className="px-4 py-3">
        <p className="font-medium text-navy-900">{s.personnels?.prenom} {s.personnels?.nom}</p>
        <p className="text-xs text-navy-900/40">{s.personnels?.fonction || ""}</p>
      </td>
      <td className="px-4 py-3 text-right">
        <input value={brut} disabled={s.paye} onChange={(e) => setBrut(e.target.value.replace(/[^0-9]/g, ""))} onBlur={commit} className={champNum} />
      </td>
      <td className="px-4 py-3 text-right">
        <input value={prime} disabled={s.paye} onChange={(e) => setPrime(e.target.value.replace(/[^0-9]/g, ""))} onBlur={commit} className={champNum} />
      </td>
      <td className="px-4 py-3 text-right">
        <input value={retenue} disabled={s.paye} onChange={(e) => setRetenue(e.target.value.replace(/[^0-9]/g, ""))} onBlur={commit} className={champNum} />
      </td>
      <td className="px-4 py-3 text-right font-mono font-semibold text-navy-900">{fmt(net)}</td>
      <td className="px-4 py-3">
        {s.paye
          ? <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Payé</span>
          : <span className="rounded-full bg-navy-900/5 px-2.5 py-0.5 text-xs font-medium text-navy-900/60">À payer</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-3 text-xs">
          <button onClick={() => onBulletin(s)} className="text-navy-700 hover:text-or-500">bulletin</button>
          {s.paye
            ? <button onClick={() => onAnnuler(s.id)} className="text-navy-900/50 hover:underline">annuler</button>
            : <button onClick={() => onPayer(s.id, {})} className="font-medium text-emerald-700 hover:underline">payer</button>}
          {!s.paye && <button onClick={() => onSuppr(s.id)} className="text-rose-500 hover:underline">suppr.</button>}
        </div>
      </td>
    </tr>
  );
}

function ModalePersonnel({ ouvert, onFermer, onCreer }) {
  const vide = {
    prenom: "", nom: "", fonction: "Enseignant", telephone: "", email: "", date_embauche: "",
    type: "CDI", salaire_base: "", debut: "",
  };
  const [f, setF] = useState(vide);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Nouveau personnel" large>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        if (!f.prenom.trim() || !f.nom.trim()) return;
        onCreer(
          { prenom: f.prenom.trim(), nom: f.nom.trim(), fonction: f.fonction, telephone: f.telephone, email: f.email, date_embauche: f.date_embauche },
          { type: f.type, salaire_base: f.salaire_base, debut: f.debut || f.date_embauche || null }
        );
        setF(vide);
      }}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Champ label="Prénom *" value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} />
          <Champ label="Nom *" value={f.nom} onChange={(e) => maj("nom", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Fonction</span>
            <select value={f.fonction} onChange={(e) => maj("fonction", e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              {api.FONCTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <Champ label="Téléphone" type="tel" value={f.telephone} onChange={(e) => maj("telephone", e.target.value)} />
          <Champ label="Email" type="email" value={f.email} onChange={(e) => maj("email", e.target.value)} />
        </div>

        <div className="rounded-xl border border-navy-900/10 bg-creme/40 p-4">
          <p className="mb-3 text-sm font-medium text-navy-900/70">Contrat</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Type</span>
              <select value={f.type} onChange={(e) => maj("type", e.target.value)}
                className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
                {api.TYPES_CONTRAT.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <Champ label="Salaire de base" value={f.salaire_base} onChange={(e) => maj("salaire_base", e.target.value.replace(/[^0-9]/g, ""))} />
            <Champ label="Date d'embauche" type="date" value={f.date_embauche} onChange={(e) => maj("date_embauche", e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit">Enregistrer</Bouton>
        </div>
      </form>
    </Modale>
  );
}

function ModaleBulletin({ bulletin, onFermer, ecole, devise }) {
  if (!bulletin) return null;
  const net = Number(bulletin.montant_net || 0);
  const p = bulletin.personnels || {};
  return (
    <Modale ouvert={!!bulletin} onFermer={onFermer} titre="Bulletin de paie" large>
      <div className="space-y-5">
        <div className="zone-impression rounded-xl border border-navy-900/10 bg-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Cachet size={48} sigle={ecole?.sigle || "GS"} className="text-navy-900/70" />
              <div>
                <p className="font-display text-lg font-bold text-navy-900">{ecole?.nom}</p>
                <p className="text-xs text-navy-900/50">Bulletin de paie — {libellePeriode(bulletin.periode)}</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium text-navy-900">{p.prenom} {p.nom}</p>
              <p className="text-xs text-navy-900/50">{p.fonction || ""}</p>
            </div>
          </div>

          <table className="mt-5 w-full text-left text-sm">
            <tbody>
              <LigneB l="Salaire brut" v={`${fmt(bulletin.montant_brut)} ${devise}`} />
              <LigneB l="Primes / indemnités" v={`+ ${fmt(bulletin.prime)} ${devise}`} />
              <LigneB l="Retenues" v={`− ${fmt(bulletin.retenue)} ${devise}`} />
            </tbody>
          </table>
          <div className="mt-3 flex justify-between border-t-2 border-navy-900/15 pt-3">
            <span className="font-display font-bold text-navy-900">NET À PAYER</span>
            <span className="font-display text-xl font-bold text-navy-900">{fmt(net)} {devise}</span>
          </div>

          <div className="mt-6 flex justify-between text-xs text-navy-900/50">
            <span>{bulletin.paye ? `Payé le ${bulletin.date_paiement || ""}` : "Non payé"}</span>
            <span>Signature & cachet</span>
          </div>
        </div>

        <div className="no-print flex justify-end gap-2">
          <Bouton variante="fantome" onClick={onFermer}>Fermer</Bouton>
          <Bouton onClick={() => window.print()}>Imprimer</Bouton>
        </div>
      </div>
    </Modale>
  );
}

function SyntheseCarte({ label, valeur, ton }) {
  const tons = { navy: "text-navy-900", rouge: "text-rose-600", or: "text-or-600", vert: "text-emerald-700" };
  return (
    <Carte className="p-5">
      <p className="text-sm text-navy-900/50">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold ${tons[ton] || tons.navy}`}>{valeur}</p>
    </Carte>
  );
}

function AlerteRH({ onClick, label, valeur, sous, actif, ton }) {
  const cadre = {
    rouge: actif ? "border-rose-300 bg-rose-50" : "border-navy-900/10",
    or: actif ? "border-or-500/40 bg-or-500/5" : "border-navy-900/10",
    navy: actif ? "border-navy-800/30 bg-navy-900/5" : "border-navy-900/10",
  };
  const chiffre = actif
    ? (ton === "rouge" ? "text-rose-600" : ton === "or" ? "text-or-600" : "text-navy-900")
    : "text-navy-900/30";
  return (
    <button onClick={onClick} className={`block rounded-2xl border p-5 text-left shadow-sm transition hover:shadow-md ${cadre[ton]}`}>
      <p className="text-sm font-medium text-navy-900/60">{label}</p>
      <p className={`mt-1 font-display text-3xl font-bold ${chiffre}`}>{valeur ?? 0}</p>
      {sous && <p className="mt-1 text-xs text-navy-900/45">{sous}</p>}
    </button>
  );
}

function LigneB({ l, v }) {
  return (
    <tr className="border-b border-navy-900/5">
      <td className="py-2 text-navy-900/70">{l}</td>
      <td className="py-2 text-right font-mono text-navy-900">{v}</td>
    </tr>
  );
}
