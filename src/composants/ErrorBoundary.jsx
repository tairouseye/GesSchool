import { Component } from "react";

// Erreurs de chargement de « chunk » (page) après un déploiement.
const estErreurChunk = (e) =>
  /dynamically imported module|Importing a module script failed|ChunkLoadError|Failed to fetch/i.test(String(e?.message || e));

// Filet global : aucune page ne peut « rester blanche ». Une erreur de chunk
// (cache périmé) déclenche un rechargement ; toute autre erreur affiche un
// message avec un bouton « Recharger ».
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) {
    if (estErreurChunk(err)) {
      const dernier = Number(sessionStorage.getItem("gs_reload_chunk") || 0);
      if (Date.now() - dernier > 10000) {
        sessionStorage.setItem("gs_reload_chunk", String(Date.now()));
        window.location.reload();
      }
    }
  }
  render() {
    if (!this.state.err) return this.props.children;
    if (estErreurChunk(this.state.err)) {
      return <div className="grid min-h-[60vh] place-items-center text-sm text-navy-900/50">Mise à jour de l'application… un instant.</div>;
    }
    return (
      <div className="grid min-h-[60vh] place-items-center p-6 text-center">
        <div className="max-w-sm">
          <p className="font-display text-lg font-bold text-navy-900">Un souci d'affichage est survenu</p>
          <p className="mt-1 text-sm text-navy-900/60">Rechargez la page pour continuer. Si cela persiste, contactez l'assistance.</p>
          <button onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-creme hover:bg-navy-800">
            Recharger
          </button>
        </div>
      </div>
    );
  }
}
