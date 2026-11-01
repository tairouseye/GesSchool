import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Bouton, Alerte } from "@/composants/ui.jsx";
import { ECOLES_REFERENCES } from "@/lib/references.js";
import GesProSignature from "@/composants/GesProSignature.jsx";
import { GESPRO } from "@/lib/gespro.js";
import Logo from "@/composants/Logo.jsx";
import { Icone } from "@/composants/Icones.jsx";
import { fondDuMois } from "@/lib/fondsConnexion.js";
import { getEncartsConnexion } from "@/lib/encarts.js";
import { messageErreur } from "@/lib/erreurs.js";
import { biometrieSupportee, connecterBiometrie, messageBiometrie } from "@/lib/biometrie.js";
import { entrerEnDemo } from "@/lib/demo.js";
import { connexionTelephone, activerTelephone, connexionParentMemorisee } from "@/lib/connexionTelephone.js";

// Page Connexion / Inscription (onglets).
export default function Connexion() {
  const { connexion, inscription } = useAuth();
  const navigate = useNavigate();
  // « Créer mon école », depuis la démo, ouvre directement l'inscription.
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("mode") === "inscription" ? "inscription" : "connexion"); // 'connexion' | 'inscription'
  const [email, setEmail] = useState("");
  //  Parents : connexion par NUMÉRO (mig. 221). Proposée d'office sur
  //  téléphone — c'est là qu'arrive un parent qui a scanné le QR code — et
  //  sur un appareil où un parent s'est déjà connecté ainsi.
  const [voie, setVoie] = useState(() => (connexionParentMemorisee()
    || (typeof window !== "undefined" && window.matchMedia?.("(max-width: 640px)").matches) ? "telephone" : "email"));
  const [telephone, setTelephone] = useState("");
  const [avecCode, setAvecCode] = useState(false); // première connexion ou mot de passe oublié
  const [code, setCode] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [demoOuverte, setDemoOuverte] = useState(false);
  const [fond] = useState(() => fondDuMois());
  const [fondPret, setFondPret] = useState(false);
  //  Photo déjà en cache : elle peut être chargée avant que React n'écoute
  //  `onLoad`, et resterait alors invisible.
  const photoRef = useRef(null);
  useEffect(() => { if (photoRef.current?.complete && photoRef.current.naturalWidth) setFondPret(true); }, []);

  // Empreinte ou visage (passkey) : pas d'e-mail à taper, le téléphone
  // retrouve le compte. Une annulation n'est pas une erreur à afficher.
  async function connexionBio() {
    setErreur(""); setInfo(""); setEnCours(true);
    try {
      await connecterBiometrie();
      navigate("/", { replace: true });
    } catch (err) {
      const m = messageBiometrie(err);
      if (m !== "Opération annulée.") setErreur(m);
    } finally {
      setEnCours(false);
    }
  }

  // Démonstration sans compte (mig. 216) : une école fictive, en lecture
  // seule. La garde de « / » envoie ensuite chacun dans son espace.
  async function decouvrir(espace) {
    setErreur(""); setInfo(""); setEnCours(true);
    try {
      await entrerEnDemo(espace);
      navigate("/", { replace: true });
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  }

  async function soumettre(e) {
    e.preventDefault();
    setErreur("");
    setInfo("");
    setEnCours(true);
    try {
      if (mode === "connexion" && voie === "telephone") {
        if (avecCode) await activerTelephone(telephone, code, mdp);
        else await connexionTelephone(telephone, mdp);
        navigate("/", { replace: true });
      } else if (mode === "connexion") {
        const { error } = await connexion(email, mdp);
        if (error) throw error;
        navigate("/", { replace: true });
      } else {
        const { data, error } = await inscription(email, mdp);
        if (error) throw error;
        // Selon la config Supabase, une confirmation e-mail peut être requise.
        if (data.session) navigate("/", { replace: true });
        else setInfo("Compte créé. Vérifiez votre e-mail pour confirmer, puis connectez-vous.");
      }
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="relative min-h-dscreen overflow-hidden bg-navy-900">
      {/* Le fond du mois : la photo apparaît en fondu une fois chargée ; en
          attendant (ou hors ligne), le navy de la charte. Le voile navy
          garde le logo et les textes crème lisibles sur n'importe quelle
          photo. Le fond est fixé à l'écran (pas à la page, plus haute que
          l'écran sur téléphone, qui agrandissait la photo) ; écran en
          hauteur : la photo paysage entière, sur une copie floutée qui
          remplit les bandes. */}
      <div aria-hidden="true" className={`fixed inset-0 transition-opacity duration-700 ${fondPret ? "opacity-100" : "opacity-0"}`}>
        <img src={fond.image} alt="" className="absolute inset-0 hidden h-full w-full scale-110 object-cover blur-xl portrait:block" />
        <img ref={photoRef} src={fond.image} alt="" onLoad={() => setFondPret(true)}
          style={{ objectPosition: fond.position }}
          className="absolute inset-0 h-full w-full object-cover portrait:object-contain portrait:!object-center" />
      </div>
      <div aria-hidden="true" className="fixed inset-0 bg-gradient-to-b from-navy-900/60 via-transparent to-navy-900/75" />

      <div className="relative grid min-h-dscreen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Le produit seul en tête : logo, nom, devise, d'un bloc serré.
            La signature GesPro et la version descendent en bas de page. */}
        <div className="mb-7 flex flex-col items-center text-creme">
          <Logo size={80} fond className="rounded-full shadow-lg" />
          <h1 className="mt-4 font-display text-3xl font-bold leading-none">
            Ges<span className="text-or-500">School</span>
          </h1>
          <p className="mt-2 text-sm text-creme/80">L'école connectée, la gestion simplifiée</p>
        </div>

        {/* Carte en verre, sur téléphone comme sur ordinateur : la photo du
            mois passe à travers (comme les applis bancaires). Voile et flou
            légers : la photo reste visible derrière les champs. */}
        <div className="rounded-2xl border border-white/30 bg-navy-900/15 p-5 shadow-xl backdrop-blur-[2px] [text-shadow:0_1px_3px_rgb(0_0_0/0.45)] sm:p-7">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-white/15 p-1">
            {["connexion", "inscription"].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErreur(""); setInfo(""); }}
                className={`rounded-lg py-2 text-sm font-semibold capitalize transition ${
                  mode === m ? "bg-navy-900 text-creme" : "text-creme/85 hover:text-creme"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {mode === "connexion" && (
            <div className="mb-4 flex justify-center gap-1 text-sm" role="tablist" aria-label="Se connecter avec">
              {[["telephone", "Mon numéro"], ["email", "Mon e-mail"]].map(([v, l]) => (
                <button key={v} type="button" role="tab" aria-selected={voie === v}
                  onClick={() => { setVoie(v); setErreur(""); setInfo(""); }}
                  className={`rounded-full px-4 py-1.5 font-medium transition ${voie === v ? "bg-white/90 text-navy-900 [text-shadow:none]" : "text-creme/85 hover:text-creme"}`}>
                  {l}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={soumettre} className="space-y-4">
            {mode === "connexion" && voie === "telephone" ? (
              <>
                <ChampConnexion
                  label="Mon numéro de téléphone" type="tel" inputMode="tel" required autoComplete="tel"
                  value={telephone} onChange={(e) => setTelephone(e.target.value)}
                  placeholder="77 123 45 67"
                />
                {avecCode && (
                  <ChampConnexion
                    label="Code parent (remis par l'école)" required autoComplete="one-time-code"
                    value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="A1B2C3D4" style={{ letterSpacing: "0.2em" }}
                  />
                )}
                <ChampConnexion
                  motDePasse label={avecCode ? "Choisissez un mot de passe (8 caractères ou plus)" : "Mot de passe"}
                  required minLength={avecCode ? 8 : 6}
                  autoComplete={avecCode ? "new-password" : "current-password"}
                  value={mdp} onChange={(e) => setMdp(e.target.value)}
                  placeholder="••••••••"
                />
              </>
            ) : (
              <>
                <ChampConnexion
                  label="E-mail" type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@ecole.sn"
                />
                <ChampConnexion
                  motDePasse label="Mot de passe" required minLength={6}
                  autoComplete={mode === "connexion" ? "current-password" : "new-password"}
                  value={mdp} onChange={(e) => setMdp(e.target.value)}
                  placeholder="••••••••"
                />
              </>
            )}

            <Alerte ton="erreur">{erreur}</Alerte>
            <Alerte ton="succes">{info}</Alerte>

            <Bouton type="submit" variante="or" disabled={enCours}
              className="w-full">
              {enCours ? "Patientez…" : mode === "connexion" && voie === "telephone" && avecCode ? "Ouvrir mon espace"
                : mode === "connexion" ? "Se connecter" : "Créer le compte"}
            </Bouton>
          </form>

          {mode === "connexion" && voie === "telephone" && (
            <div className="mt-4 text-center text-sm">
              <button type="button" onClick={() => { setAvecCode((a) => !a); setErreur(""); }}
                className="text-creme underline-offset-2 hover:text-or-400 hover:underline">
                {avecCode ? "J'ai déjà mon mot de passe" : "Première connexion ou mot de passe oublié ? J'ai un code parent"}
              </button>
              {avecCode && (
                <p className="mt-2 text-xs text-creme/80">Pas de code ? Demandez-le au secrétariat de l&apos;école.</p>
              )}
            </div>
          )}
          {mode === "connexion" && voie === "email" && (
            <div className="mt-4 text-center">
              <Link to="/mot-de-passe-oublie" className="text-sm text-creme hover:text-or-400">
                Mot de passe oublié ?
              </Link>
            </div>
          )}

          {mode === "connexion" && (
            <>
              <div className="my-4 flex items-center gap-3 text-xs text-creme/75">
                <span className="h-px flex-1 bg-white/30" />ou<span className="h-px flex-1 bg-white/30" />
              </div>
              {/* Deux gestes côte à côte, sans texte à lire : le cadre de
                  visée (comme les applis bancaires) et la démo. Le détail de
                  la démo ne se déplie qu'au toucher, pour garder la carte
                  courte. */}
              <div className="flex items-start justify-center gap-2">
                {biometrieSupportee() && (
                  <button type="button" onClick={connexionBio} disabled={enCours}
                    aria-label="Se connecter avec l'empreinte ou le visage"
                    className="flex w-32 flex-col items-center gap-1.5 rounded-2xl px-3 py-2 text-white hover:bg-white/10 disabled:opacity-60">
                    <Icone name="biometrie" className="h-12 w-12" />
                    <span className="text-xs font-medium text-creme/85">Empreinte ou visage</span>
                  </button>
                )}
                <button type="button" onClick={() => setDemoOuverte((o) => !o)} disabled={enCours}
                  aria-expanded={demoOuverte} aria-controls="choix-demo"
                  className={`flex w-32 flex-col items-center gap-1.5 rounded-2xl px-3 py-2 text-white hover:bg-white/10 disabled:opacity-60 ${demoOuverte ? "bg-white/10" : ""}`}>
                  <Icone name="demo" className="h-12 w-12" />
                  <span className="text-xs font-medium text-creme/85">Démo</span>
                </button>
              </div>

              {/* Sans compte : une école fictive, pour voir avant de s'inscrire. */}
              {demoOuverte && (
                <div id="choix-demo" className="mt-3 rounded-xl bg-white/10 p-3 text-center ring-1 ring-white/20">
                  <p className="text-sm font-semibold text-creme">Découvrir GesSchool sans compte</p>
                  <p className="mt-0.5 text-xs text-creme/80">Une école fictive : regardez tout, rien n'est enregistré.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => decouvrir("parent")} disabled={enCours}
                      className="rounded-xl bg-white/15 px-3 py-2.5 text-sm font-semibold text-creme ring-1 ring-white/30 hover:bg-white/25 disabled:opacity-60">
                      Comme parent
                      <span className="block text-[11px] font-normal text-creme/75">sur téléphone</span>
                    </button>
                    <button type="button" onClick={() => decouvrir("direction")} disabled={enCours}
                      className="rounded-xl bg-white/15 px-3 py-2.5 text-sm font-semibold text-creme ring-1 ring-white/30 hover:bg-white/25 disabled:opacity-60">
                      Comme direction
                      <span className="block text-[11px] font-normal text-creme/75">sur ordinateur</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <EncartConnexion fond={fond} />

        {ECOLES_REFERENCES.length > 0 && (
          <div className="mt-8">
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-creme/40">
              Ils nous font confiance
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {ECOLES_REFERENCES.map((e) => (
                <div key={e.nom} className="flex items-center gap-2 rounded-xl bg-white/95 px-3.5 py-2 shadow-sm ring-1 ring-white/10">
                  <img src={e.logo} alt={e.nom} className="h-9 w-9 shrink-0 object-contain" />
                  <span className="text-sm font-semibold text-navy-900">{e.nom}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <GesProSignature ton="sombre" avecContacts avecSlogan={false} avecVersion={false} className="mt-6" />
        <div className="mt-4 text-center">
          {/* « une solution… » sert aussi en milieu de phrase ailleurs : la
              majuscule est posée ici, où la mention ouvre la ligne. */}
          <p className="text-xs font-medium text-creme/60">{GESPRO.signature.charAt(0).toUpperCase() + GESPRO.signature.slice(1)}</p>
          <p className="mt-1 font-mono text-[11px] text-creme/60">v{__APP_VERSION__} · {__BUILD_DATE__}</p>
        </div>
      </div>
      </div>
    </div>
  );
}

// L'encart sous la carte : le conseil du mois, en alternance avec les
// partenaires de l'éducation en cours (migration 215, saisis dans la console
// super-admin). Sans partenaire, le conseil reste seul et rien ne défile.
const DUREE_ENCART = 7000;

function EncartConnexion({ fond }) {
  const [partenaires, setPartenaires] = useState([]);
  const [tour, setTour] = useState(0);

  useEffect(() => {
    let vivant = true;
    getEncartsConnexion().then((p) => { if (vivant) setPartenaires(p); });
    return () => { vivant = false; };
  }, []);

  const total = 1 + partenaires.length;
  useEffect(() => {
    if (total < 2) return undefined;
    //  Pas de défilement automatique pour qui l'a désactivé dans son système.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const t = setInterval(() => setTour((n) => n + 1), DUREE_ENCART);
    return () => clearInterval(t);
  }, [total]);

  const i = tour % total;
  const p = i === 0 ? null : partenaires[i - 1];

  return (
    <div className="mt-4">
      <div key={i} className="min-h-[4.5rem] animate-[fondu_.4s_ease-out] rounded-2xl bg-creme/95 px-4 py-3 shadow-lg">
        {p ? (
          <div className="flex items-center gap-3">
            {p.logo_url && (
              <img src={p.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-navy-900/10 bg-white object-contain p-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-or-600">Partenaire · {p.partenaire}</p>
              <p className="mt-0.5 text-sm text-navy-900/80">
                {p.message}
                {p.lien && (
                  <> <a href={p.lien} target="_blank" rel="noopener noreferrer sponsored"
                    className="whitespace-nowrap font-semibold text-navy-700 hover:text-or-600">En savoir plus ›</a></>
                )}
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-or-600">{fond.type} · {fond.theme}</p>
            <p className="mt-0.5 text-sm text-navy-900/80">{fond.message}</p>
          </>
        )}
      </div>
      {total > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {Array.from({ length: total }, (_, k) => (
            <button key={k} type="button" onClick={() => setTour(k)} aria-label={`Message ${k + 1} sur ${total}`}
              className={`h-1.5 rounded-full transition-all ${k === i ? "w-4 bg-or-500" : "w-1.5 bg-creme/50"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// Champ de la page de connexion : souligné blanc sur la photo, sans fond
// (16 px pour que l'iPhone ne zoome pas). `champ-verre` neutralise le fond jaune de
// l'autoremplissage du navigateur (index.css).
function ChampConnexion({ label, motDePasse = false, type, ...props }) {
  const [voir, setVoir] = useState(false);
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-creme/85">{label}</span>
      <div className="relative">
        <input
          type={motDePasse ? (voir ? "text" : "password") : type}
          className={`champ-verre w-full border-0 border-b border-white/60 bg-transparent px-1 py-2.5 text-base text-white outline-none transition placeholder:text-white/55 focus:border-or-400 ${motDePasse ? "pr-11" : ""}`}
          {...props}
        />
        {motDePasse && (
          <button type="button" onClick={() => setVoir((v) => !v)}
            aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            title={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-white/75 transition hover:text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {voir ? (
                <><path d="M3 3l18 18" /><path d="M10.6 10.6a3 3 0 004.2 4.2" /><path d="M9.9 5.1A9.5 9.5 0 0112 5c6.5 0 10 7 10 7a17.2 17.2 0 01-3.3 4.1M6.6 6.6A17.3 17.3 0 002 12s3.5 7 10 7a9.6 9.6 0 004.1-.9" /></>
              ) : (
                <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>
              )}
            </svg>
          </button>
        )}
      </div>
    </label>
  );
}
