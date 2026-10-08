import type { Role } from '@/lib/authorization';

import { MANAGEMENT_HOME, TENANT_HOME } from './home';

/**
 * Destinations de la navigation principale (Component Specification section 58,
 * Information Architecture 7.1 à 7.3).
 *
 * Pure : ni base, ni HTTP, ni React, donc testable sans monter de serveur. Et
 * SOURCE UNIQUE : la barre basse du téléphone et la rangée d'onglets de l'écran
 * large lisent cette même liste. Deux listes finiraient par offrir deux
 * navigations différentes selon la largeur, ce qui est exactement ce qu'un
 * utilisateur ne doit pas constater en tournant son appareil.
 *
 * **Trois règles tenues ici, et elles expliquent chaque absence.**
 *
 * 1. **Cinq entrées au maximum**, la charte l'impose. Le produit en propose
 *    quatre à qui gère et deux à qui loue : il reste de la place, et c'est
 *    volontaire, les lots suivants en ajoutant.
 * 2. **Aucune entrée morte.** La section 58 donne en exemple « Accueil,
 *    Immeubles, Loyers, Maintenance, Profil ». Maintenance n'existera qu'au Lot
 *    13 et n'y figure donc pas. « Accueil » non plus : les tableaux de bord sont
 *    au Lot 19, et d'ici là l'accueil de qui gère EST la liste des immeubles,
 *    donc deux entrées mèneraient au même écran.
 * 3. **Seules les destinations de PREMIER niveau.** Les baux n'y sont pas, et
 *    ce n'est pas un oubli : l'architecture de l'information ne les place pas au
 *    premier niveau, ils se rejoignent depuis un immeuble, un appartement, un
 *    locataire ou un loyer. Les y mettre aurait fait cinq entrées dont une
 *    redondante.
 *
 * **La navigation est adaptée au RÔLE et non au périmètre**, comme la racine du
 * produit (DEC-046) : un gestionnaire sans immeuble attribué doit bien voir
 * « Immeubles », et y lire qu'aucun immeuble ne lui a été confié. Masquer
 * l'entrée lui laisserait croire que le produit est vide.
 *
 * Ne pas montrer une entrée ne suffit d'ailleurs jamais : l'adresse reste
 * tapable, et c'est le cas d'usage qui refuse. Cette liste décide de ce qui est
 * MONTRÉ, pas de ce qui est permis.
 */
export type NavigationEntry = {
  href: string;
  label: string;
  /** Nom d'une icône de la charte, jamais un dessin improvisé. */
  icon: 'immeuble' | 'logement' | 'locataires' | 'paiements' | 'acces';
};

/** Destination du compte : le rôle, l'organisation, et la déconnexion. */
export const ACCOUNT_HOME = '/compte';

/**
 * Navigation de qui gère des immeubles, propriétaire comme gestionnaire.
 *
 * Les deux rôles reçoivent la MÊME liste, et c'est juste : les quatre
 * destinations sont ouvertes aux deux, chacun sur son périmètre. Ce qui les
 * sépare, les gestionnaires, est réservé au propriétaire (DEC-025) et se rejoint
 * depuis l'écran du patrimoine, faute d'une cinquième place qui vaille mieux que
 * « Loyers ».
 */
const MANAGEMENT_ENTRIES: readonly NavigationEntry[] = [
  { href: MANAGEMENT_HOME, label: 'Immeubles', icon: 'immeuble' },
  { href: '/locataires', label: 'Locataires', icon: 'locataires' },
  { href: '/loyers', label: 'Loyers', icon: 'paiements' },
  { href: ACCOUNT_HOME, label: 'Compte', icon: 'acces' },
];

/**
 * Navigation du locataire.
 *
 * Deux entrées, et c'est l'état réel de son espace : son logement, qui porte
 * aussi son contrat et ses loyers, et son compte. L'architecture 7.3 en prévoit
 * sept ; les cinq autres naissent des lots suivants, et elles sont ANNONCÉES sur
 * son écran plutôt que posées ici en liens morts.
 *
 * Aucune entrée vers un immeuble : un locataire n'en atteint aucun, et l'écran
 * n'existe pas pour lui (DEC-046).
 */
const TENANT_ENTRIES: readonly NavigationEntry[] = [
  { href: TENANT_HOME, label: 'Mon logement', icon: 'logement' },
  { href: ACCOUNT_HOME, label: 'Compte', icon: 'acces' },
];

/**
 * Navigation de qui n'a plus aucun accès actif (BR-019, DEC-044).
 *
 * Une seule entrée, le compte. Son accès a été suspendu ou révoqué, et
 * l'enveloppe authentifiée lui affiche « aucun accès actif » : lui proposer les
 * immeubles, les locataires et les loyers donnerait TROIS liens qui répondent
 * tous « introuvable », ce qui ressemble à une panne alors que la situation est
 * voulue et expliquée à l'écran.
 *
 * Le compte, lui, reste indispensable : c'est de là qu'on se déconnecte, et sans
 * lui cette personne resterait enfermée sur un message.
 */
const NO_ACCESS_ENTRIES: readonly NavigationEntry[] = [
  { href: ACCOUNT_HOME, label: 'Compte', icon: 'acces' },
];

/**
 * Destinations correspondant à un ensemble de rôles.
 *
 * Le rôle de GESTION gagne en cas de cumul, exactement comme `homeForRoles` :
 * une personne à la fois propriétaire et locataire vient d'abord travailler, et
 * son espace locataire reste à un clic depuis son compte. Deux navigations
 * fusionnées donneraient six entrées, au-delà de la limite de la charte.
 */
export function navigationForRoles(roles: readonly Role[]): readonly NavigationEntry[] {
  if (roles.length === 0) return NO_ACCESS_ENTRIES;

  return roles.every((role) => role === 'TENANT') ? TENANT_ENTRIES : MANAGEMENT_ENTRIES;
}

/**
 * L'entrée correspond-elle à l'écran affiché ?
 *
 * Correspondance par PRÉFIXE de segment, et non par égalité : la fiche
 * `/loyers/abc` doit allumer « Loyers », sinon l'utilisateur perd son repère dès
 * qu'il descend d'un niveau. Le préfixe est comparé segment par segment, faute
 * de quoi `/locataires` allumerait une entrée `/loc`.
 *
 * La racine `/` n'allume rien : elle redirige selon le rôle et n'est jamais
 * affichée.
 */
export function isCurrentEntry(entry: NavigationEntry, pathname: string): boolean {
  if (entry.href === pathname) return true;

  return pathname.startsWith(`${entry.href}/`);
}
