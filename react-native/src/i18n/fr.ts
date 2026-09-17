import type { Dict } from './es';

/**
 * Mismo shape que `es.ts` por contrato de tipos (`Dict`). Si falta o sobra
 * una clave, o una función no coincide en parámetros, esto no compila.
 *
 * Dos diferencias deliberadas respecto a `es.ts`/`en.ts`, ambas por gramática
 * francesa y no por descuido:
 *
 * - El plural cae en `n < 2`, no en `n === 1`: en francés el cero va en
 *   singular ("0 personnage", no "0 personnages").
 * - Se usan comillas francesas « » y espacio antes de « ? » y « : », que es
 *   la tipografía correcta en francés.
 */
export const fr: Dict = {
  common: {
    cancel: 'Annuler',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    create: 'Créer',
    creating: 'Création…',
    edit: 'Modifier',
    delete: 'Supprimer',
    close: 'Fermer',
    loading: 'Chargement…',
    errorGeneric: 'Une erreur est survenue',
    notFilled: 'Non renseigné.',
    noBookTitle: 'Aucun livre',
    noBookMessage: 'Créez un livre dans l’onglet Livres pour commencer.',
    choosePlaceholder: 'Choisir…',
    searchPlaceholder: 'Rechercher…',
    noMatch: (query) => `Aucun résultat pour « ${query} ».`,
  },

  roles: {
    PROTAGONIST: 'Protagoniste',
    ANTAGONIST: 'Antagoniste',
    SECONDARY: 'Secondaire',
    EXTRA: 'Figurant',
  },

  tabs: {
    books: 'Livres',
    plot: 'Intrigue',
    characters: 'Personnages',
    chapters: 'Chapitres',
    settings: 'Réglages',
    characterDetail: 'Fiche',
    chapterDetail: 'Chapitre',
  },

  unsaved: {
    default:
      'Des modifications ne sont pas enregistrées. Si vous partez maintenant, elles seront perdues.',
    alertTitle: 'Modifications non enregistrées',
    keepEditing: 'Continuer à modifier',
    discard: 'Abandonner',
  },

  books: {
    editTitle: 'Modifier le livre',
    newTitle: 'Nouveau livre',
    fieldTitle: 'Titre',
    titlePlaceholder: 'Le nom de votre roman',
    fieldAuthor: 'Auteur',
    authorPlaceholder: 'Qui l’écrit',
    fieldSynopsis: 'Synopsis',
    synopsisHint: 'De quoi ça parle, en un paragraphe',
    exportedAlertTitle: 'Exporté',
    exportedAlertBody: (uri) => `Enregistré dans :\n${uri}`,
    exportDialogTitle: (title) => `Exporter « ${title} »`,
    invalidJson: 'Le fichier n’est pas un JSON valide',
    importedAlertTitle: 'Importé',
    importedAlertBody: (title) => `« ${title} » est maintenant sur cet appareil.`,
    confirmDeleteTitle: 'Supprimer le livre',
    confirmDeleteBody: (title) =>
      `Supprimer « ${title} » ? Ses personnages, ses chapitres et toute son intrigue seront perdus. C’est irréversible.`,
    title: 'Livres',
    newBook: '+ Livre',
    importJson: 'Importer un JSON',
    importing: 'Importation…',
    empty: 'Aucun livre pour l’instant. Créez le premier pour commencer.',
    active: 'Actif',
    charactersLabel: (n) => `${n} personnage${n < 2 ? '' : 's'}`,
    chaptersLabel: (n) => `${n} chapitre${n < 2 ? '' : 's'}`,
    eventsLabel: (n) => `${n} événement${n < 2 ? '' : 's'}`,
    activate: 'Activer',
    export: 'Exporter',
  },

  characters: {
    count: (n) => `${n} personnage${n < 2 ? '' : 's'}`,
    newCharacter: '+ Personnage',
    empty: 'Aucun personnage dans ce livre pour l’instant.',
    newSheetTitle: 'Nouveau personnage',
    fieldName: 'Nom',
    namePlaceholder: 'Comment on l’appelle',
    fieldRole: 'Rôle',
  },

  characterDetail: {
    notFound: 'Personnage introuvable.',
    confirmDeleteTitle: 'Supprimer le personnage',
    confirmDeleteBody: (name) => `Supprimer ${name} ? Son arc et ses relations seront perdus.`,
    unsavedMessage:
      'Ce personnage a des modifications non enregistrées. Si vous partez maintenant, elles seront perdues.',
    sectionPhysical: 'Description physique',
    sectionPersonality: 'Personnalité',
    sectionBackstory: 'Passé',
    sectionPersonalPlot: 'Intrigue personnelle',
    sectionArc: 'Arc',
    sectionRelationships: 'Relations',
    sectionNotes: 'Notes',
    editTitle: 'Modifier le personnage',
    fieldAge: 'Âge',
    agePlaceholder: 'la quarantaine',
    fieldPhysical: 'Description physique',
    fieldPersonality: 'Personnalité',
    fieldBackstory: 'Passé',
    backstoryHint: 'Ce qui lui est arrivé AVANT le début du livre',
    fieldPersonalPlot: 'Intrigue personnelle',
    personalPlotHint: 'Ce qui lui ARRIVE pendant le livre',
    fieldArcSummary: 'Résumé de l’arc',
    arcSummaryHint: 'Comment il ou elle CHANGE intérieurement',
    fieldNotes: 'Notes',

    arcEmpty:
      'Aucune étape. Découpez l’arc en moments : point de départ, élément déclencheur, crise, transformation.',
    editArc: 'Modifier l’arc',
    addStages: 'Ajouter des étapes',
    stageTitlePlaceholder: 'Titre de l’étape',
    stageDescriptionPlaceholder: 'Ce qui se passe à cette étape',
    removeStage: 'Retirer',
    addStage: '+ Étape',
    saveArc: 'Enregistrer l’arc',

    relationshipsEmpty: 'Aucune relation.',
    addRelationship: '+ Relation',
    needsAnotherCharacter: 'Il vous faut un autre personnage dans le livre.',
    newRelationshipTitle: 'Nouvelle relation',
    adding: 'Ajout…',
    add: 'Ajouter',
    fieldRelatedCharacter: 'Personnage',
    relatedCharacterPlaceholder: 'Choisissez un personnage…',
    fieldRelationType: 'Est son…',
    relationTypePlaceholder: 'frère, rival, mentor',
    reciprocalLabel: (relatedName) =>
      `Comment ${relatedName ? `${relatedName} vous voit` : 'il ou elle vous voit'} (facultatif)`,
    reciprocalHint:
      'Laissez vide pour ne pas créer la relation inverse. Le texte peut différer, p. ex. « sœur ».',
    reciprocalPlaceholder: 'sœur, disciple, ennemie',
  },

  chapters: {
    count: (n) => `${n} chapitre${n < 2 ? '' : 's'}`,
    reorder: 'Réorganiser',
    newChapter: '+ Chapitre',
    saveOrder: 'Enregistrer l’ordre',
    empty: 'Aucun chapitre dans ce livre pour l’instant.',
    castCount: (n) => `${n} personnage${n < 2 ? '' : 's'}`,
    newSheetTitle: 'Nouveau chapitre',
    fieldTitle: 'Titre',
    titlePlaceholder: 'Le nom du chapitre',
    fieldSynopsis: 'Synopsis',
    synopsisHint: 'Ce qui se passe dans le chapitre',
  },

  chapterDetail: {
    notFound: 'Chapitre introuvable.',
    confirmDeleteTitle: 'Supprimer le chapitre',
    confirmDeleteBody: (title) =>
      `Supprimer « ${title} » ? Son texte et sa distribution seront perdus.`,
    unsavedMessage:
      'Ce chapitre a des modifications non enregistrées. Si vous partez maintenant, elles seront perdues.',
    position: (n) => `Chapitre ${n}`,
    sectionSynopsis: 'Synopsis',
    sectionCast: 'Distribution',
    sectionText: 'Texte',
    sectionNotes: 'Notes',
    editTitle: 'Modifier le chapitre',
    fieldTitle: 'Titre',
    fieldSynopsis: 'Synopsis',
    synopsisHint: 'Ce qui se passe dans le chapitre',
    fieldNotes: 'Notes',

    panelLabelField: 'Libellé du panneau',
    textPlaceholder: 'Écrivez le chapitre ici…',
    words: (n) => `${n} mot${n < 2 ? '' : 's'}`,
    unsavedBadge: 'Modifications non enregistrées',
    saveText: 'Enregistrer le texte',

    castEmpty: 'Personne d’assigné. Ajoutez qui apparaît et ce qu’ils font.',
    editCast: 'Modifier la distribution',
    addCast: 'Ajouter la distribution',
    removeFromCast: 'Retirer',
    castActionPlaceholder: 'Ce qu’il ou elle fait dans ce chapitre',
    unnamedCharacter: 'Personnage',
    addCharacterField: 'Ajouter un personnage',
    addCharacterPlaceholder: '+ Ajouter un personnage…',
    saveCast: 'Enregistrer la distribution',
  },

  plot: {
    eventsSectionTitle: (n) => `Événements — ${n}`,
    reorder: 'Réorganiser',
    newEvent: '+ Événement',
    saveOrder: 'Enregistrer l’ordre',
    eventsEmpty: 'Aucun événement dans l’intrigue pour l’instant.',
    seedBadge: (title) => `met en place : ${title}`,
    payoffBadge: (title) => `résout : ${title}`,

    confirmDeleteEventTitle: 'Supprimer l’événement',
    confirmDeleteEventBody: (title, parts) =>
      `Supprimer « ${title} » ?${parts.length ? ` ${parts.join(' et ')}.` : ''}`,
    seededWillBeLost: (n) => `${n} promesse(s) mise(s) en place ici seront perdues`,
    paidWillReturn: (n) => `${n} promesse(s) résolue(s) ici repasseront en attente`,

    promisesSectionTitle: (pending, total) => `Promesses — ${pending} sur ${total} non résolues`,
    newPromise: '+ Promesse',
    needsAnEvent: 'Il vous faut au moins un événement pour créer une promesse.',
    promisesEmpty: 'Aucune promesse pour l’instant.',
    pendingGroup: 'En attente',
    fulfilledGroup: 'Tenues',
    seededAt: (position, title) => `Mise en place au #${position} · ${title}`,
    paidAt: (position, title) => `résolue au #${position} · ${title}`,
    pendingBadge: 'en attente',
    outOfOrderBadge: 'résolue avant d’être mise en place',
    confirmDeletePromiseTitle: 'Supprimer la promesse',
    confirmDeletePromiseBody: (title) => `Supprimer « ${title} » ?`,

    newEventTitle: 'Nouvel événement',
    editEventTitle: 'Modifier l’événement',
    fieldEventTitle: 'Titre',
    eventTitlePlaceholder: 'Ce qui se passe',
    fieldDescription: 'Description',

    newPromiseTitle: 'Nouvelle promesse',
    editPromiseTitle: 'Modifier la promesse',
    fieldPromiseTitle: 'Titre',
    promiseTitlePlaceholder: 'Ce qui est promis au lecteur',
    fieldSetupEvent: 'Mise en place dans',
    setupEventPlaceholder: 'Choisissez l’événement…',
    fieldPayoffEvent: 'Résolue dans',
    payoffEventHint: 'Laissez « En attente » si elle n’est pas encore résolue',
    payoffPendingOption: '— En attente —',
  },

  settings: {
    title: 'Réglages',
    themeLabel: 'Thème',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    themeSystem: 'Système',
    languageLabel: 'Langue',
    // Les noms de langue sont toujours affichés dans leur propre langue
    // (endonymes), pour rester reconnaissables même quand l’interface est
    // dans une autre.
    languageEs: 'Español',
    languageEn: 'English',
    languageFr: 'Français',
    aboutLabel: 'À propos de l’application',
    rateApp: 'Noter l’application',
    privacyPolicy: 'Voir la politique de confidentialité et les conditions d’utilisation',
    showWalkthrough: 'Revoir le tutoriel',
    linkErrorTitle: 'Impossible d’ouvrir le lien',
    linkErrorBody: (url: string) => `Ouvrez-le à la main dans le navigateur :\n\n${url}`,
  },

  walkthrough: {
    title: 'Comment fonctionne Taledesk',
    stepOf: (current: number, total: number) => `Étape ${current} sur ${total}`,
    back: 'Retour',
    next: 'Suivant',
    done: 'Commencer',
    dontShowAgain: 'Ne plus afficher',
    steps: [
      {
        icon: '📚',
        title: 'Commencez par un livre',
        body: 'Tout dépend d’un livre : créez-le dans l’onglet Livres avec son titre, son auteur et son synopsis. Le livre choisi là est celui que montrent les autres onglets.',
      },
      {
        icon: '🧵',
        title: 'Organisez l’intrigue',
        body: 'Dans Intrigue, vous placez les événements clés dans l’ordre où ils surviennent et notez les promesses faites au lecteur : ce qui est posé et dans quel événement cela se résout.',
      },
      {
        icon: '👥',
        title: 'Façonnez vos personnages',
        body: 'Chaque personnage a un rôle, un physique, une personnalité, un passé, un arc en étapes et des relations avec les autres. L’intrigue est ce qui lui arrive ; l’arc, la façon dont il change intérieurement.',
      },
      {
        icon: '📖',
        title: 'Planifiez les chapitres',
        body: 'Ordonnez les chapitres, attribuez à chacun sa distribution et écrivez dans deux panneaux de texte indépendants : un brouillon et sa révision, par exemple.',
      },
      {
        icon: '💾',
        title: 'Vos données restent les vôtres',
        body: 'Tout est enregistré sur cet appareil, sans compte ni connexion. Depuis Livres, vous pouvez exporter n’importe quel livre en fichier JSON pour le sauvegarder ou le transférer.',
      },
    ],
  },

  exit: {
    title: 'Quitter Taledesk',
    message: 'Voulez-vous fermer l’application ?',
    confirm: 'Quitter',
    cancel: 'Rester ici',
  },

  app: {
    openingLibrary: 'Ouverture de la bibliothèque…',
  },
};
