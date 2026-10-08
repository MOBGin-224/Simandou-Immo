import { describe, expect, it } from 'vitest';

import type { Role } from '../../src/lib/authorization/permissions';
import { MANAGEMENT_HOME, TENANT_HOME } from '../../src/lib/ui/home';
import { ACCOUNT_HOME, isCurrentEntry, navigationForRoles } from '../../src/lib/ui/navigation';

/**
 * Navigation principale (Component Specification 58, Information Architecture 7).
 *
 * Ce test existe pour trois raisons, et chacune a déjà coûté quelque chose dans
 * ce projet.
 *
 * La LIMITE de cinq entrées est une règle de la charte, et une règle de nombre
 * se viole sans qu'on s'en aperçoive en ajoutant une entrée « utile » au lot
 * suivant.
 *
 * Une entrée MORTE est le défaut que la section 58 invite à commettre, son
 * exemple citant « Maintenance », qui n'existera qu'au Lot 13.
 *
 * Et le périmètre du LOCATAIRE est une question de sécurité autant que
 * d'interface : le conduire vers un immeuble lui donnerait un refus depuis un
 * élément présent sur tous les écrans (DEC-046).
 */
describe('Navigation principale', () => {
  const hrefsFor = (roles: Role[]) => navigationForRoles(roles).map((entry) => entry.href);

  describe('Limite de la charte', () => {
    it('ne dépasse jamais cinq entrées, quel que soit le rôle', () => {
      for (const roles of [
        [],
        ['OWNER'],
        ['MANAGER'],
        ['TENANT'],
        ['OWNER', 'MANAGER'],
        ['OWNER', 'TENANT'],
        ['OWNER', 'MANAGER', 'TENANT'],
      ] satisfies Role[][]) {
        expect(navigationForRoles(roles).length).toBeLessThanOrEqual(5);
      }
    });

    it('donne à chaque entrée un libellé et une icône de la charte', () => {
      for (const entry of navigationForRoles(['OWNER'])) {
        expect(entry.label.length).toBeGreaterThan(0);
        expect(entry.icon.length).toBeGreaterThan(0);
        expect(entry.href.startsWith('/')).toBe(true);
      }
    });

    it('ne propose jamais deux fois la même destination', () => {
      for (const roles of [['OWNER'], ['MANAGER'], ['TENANT']] satisfies Role[][]) {
        const hrefs = hrefsFor(roles);

        expect(new Set(hrefs).size).toBe(hrefs.length);
      }
    });
  });

  describe('Aucune entrée morte', () => {
    /**
     * Les écrans qui n'existent pas encore ne doivent pas figurer : la
     * maintenance arrive au Lot 13, les tableaux de bord au Lot 19, les
     * paiements au Lot 11.
     */
    it('ne conduit vers aucun écran des lots suivants', () => {
      const absent = ['/maintenance', '/incidents', '/paiements', '/tableau-de-bord', '/rapports'];

      for (const roles of [['OWNER'], ['MANAGER'], ['TENANT']] satisfies Role[][]) {
        for (const href of hrefsFor(roles)) {
          expect(absent).not.toContain(href);
        }
      }
    });

    /**
     * « Accueil » n'existe pas comme entrée distincte : les tableaux de bord sont
     * au Lot 19, et d'ici là l'accueil de qui gère EST la liste des immeubles.
     * Deux entrées mèneraient au même écran.
     */
    it("n'offre pas d'« Accueil » qui doublerait une autre entrée", () => {
      expect(hrefsFor(['OWNER'])).not.toContain('/');
      expect(hrefsFor(['TENANT'])).not.toContain('/');
    });
  });

  describe('Ce que voit celui qui gère', () => {
    it('conduit le propriétaire au patrimoine, aux locataires, aux loyers et à son compte', () => {
      expect(hrefsFor(['OWNER'])).toEqual([
        MANAGEMENT_HOME,
        '/locataires',
        '/loyers',
        ACCOUNT_HOME,
      ]);
    });

    it('donne au gestionnaire la même navigation', () => {
      expect(hrefsFor(['MANAGER'])).toEqual(hrefsFor(['OWNER']));
    });

    /**
     * Les baux ne sont PAS une destination de premier niveau : l'architecture de
     * l'information les place sous un immeuble, un appartement ou un locataire.
     */
    it('ne porte pas les baux', () => {
      expect(hrefsFor(['OWNER'])).not.toContain('/baux');
    });

    /**
     * Adaptée au RÔLE et non au périmètre : un gestionnaire sans immeuble doit
     * voir l'entrée et lire sur l'écran qu'aucun immeuble ne lui a été confié.
     * Masquer l'entrée lui laisserait croire que le produit est vide.
     */
    it('ne dépend pas du périmètre, seulement du rôle', () => {
      expect(hrefsFor(['MANAGER'])).toContain(MANAGEMENT_HOME);
    });
  });

  describe('Ce que voit le locataire', () => {
    it('le conduit à son logement et à son compte, et à rien d autre', () => {
      expect(hrefsFor(['TENANT'])).toEqual([TENANT_HOME, ACCOUNT_HOME]);
    });

    /** Un locataire n'atteint aucun immeuble : l'écran n'existe pas pour lui (DEC-046). */
    it('ne le conduit vers aucun écran de gestion', () => {
      const hrefs = hrefsFor(['TENANT']);

      expect(hrefs).not.toContain(MANAGEMENT_HOME);
      expect(hrefs).not.toContain('/locataires');
      expect(hrefs).not.toContain('/loyers');
      expect(hrefs).not.toContain('/gestionnaires');
    });

    it('reste la navigation d un locataire chez deux bailleurs', () => {
      expect(hrefsFor(['TENANT', 'TENANT'])).toEqual([TENANT_HOME, ACCOUNT_HOME]);
    });
  });

  describe('Cumul de rôles', () => {
    /**
     * La gestion gagne, exactement comme pour l'accueil : la personne vient
     * d'abord travailler, et deux navigations fusionnées donneraient six entrées,
     * au-delà de la limite de la charte.
     */
    it('donne la navigation de gestion à qui est aussi locataire', () => {
      expect(hrefsFor(['OWNER', 'TENANT'])).toEqual(hrefsFor(['OWNER']));
      expect(hrefsFor(['MANAGER', 'TENANT'])).toEqual(hrefsFor(['MANAGER']));
    });

    /**
     * Sans aucun rôle, l'enveloppe affiche « aucun accès actif ». La navigation
     * est rendue quand même, et elle doit porter le COMPTE : sans lui, cette
     * personne resterait enfermée sur un message, sans moyen de se déconnecter.
     *
     * Et elle ne porte QUE lui : les trois autres destinations répondraient
     * « introuvable », ce qui ressemblerait à une panne alors que la situation
     * est voulue et expliquée juste au-dessus.
     */
    it('ne laisse que le compte à qui n a plus aucun accès', () => {
      expect(hrefsFor([])).toEqual([ACCOUNT_HOME]);
    });
  });

  /**
   * Correspondance par PRÉFIXE de segment : la fiche `/loyers/abc` doit allumer
   * « Loyers », sinon le repère disparaît dès qu'on descend d'un niveau.
   */
  describe('Entrée courante', () => {
    const loyers = { href: '/loyers', label: 'Loyers', icon: 'paiements' } as const;

    it('reconnaît la destination elle-même', () => {
      expect(isCurrentEntry(loyers, '/loyers')).toBe(true);
    });

    it('reconnaît une page fille', () => {
      expect(isCurrentEntry(loyers, '/loyers/8f1c')).toBe(true);
      expect(isCurrentEntry(loyers, '/loyers/8f1c/detail')).toBe(true);
    });

    it('ne reconnaît pas une autre destination', () => {
      expect(isCurrentEntry(loyers, '/baux')).toBe(false);
      expect(isCurrentEntry(loyers, '/')).toBe(false);
    });

    /**
     * Le préfixe est comparé SEGMENT par segment : sans le séparateur, une entrée
     * `/loc` s'allumerait sur `/locataires`, et `/loyers` sur une hypothétique
     * page `/loyersautrechose`.
     */
    it('ne confond pas deux adresses qui partagent un préfixe de texte', () => {
      const locataires = { href: '/loc', label: 'Test', icon: 'locataires' } as const;

      expect(isCurrentEntry(locataires, '/locataires')).toBe(false);
    });
  });
});
