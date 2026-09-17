/**
 * Diccionario español. Es la forma de referencia: `en.ts` se tipa contra
 * `Dict = typeof es`, así que si a `en.ts` le falta una clave o le sobra un
 * parámetro en una función, `tsc` no compila. Sin eso no hay red de
 * seguridad posible aquí: no hay tests para la app móvil.
 *
 * Las hojas son `string` para texto fijo, o funciones para texto que depende
 * de datos (contadores, nombres interpolados, plurales). Deliberadamente NO
 * es un sistema de interpolación por plantilla de texto (`"Hola {nombre}"`):
 * una función de TypeScript ya da comprobación de tipos en los parámetros
 * gratis, y aquí no hace falta nada más — mismo criterio que el resto del
 * proyecto para evitar dependencias que no compensan (ver `useRoute.ts`).
 */
export const es = {
  common: {
    cancel: 'Cancelar',
    save: 'Guardar',
    saving: 'Guardando…',
    create: 'Crear',
    creating: 'Creando…',
    edit: 'Editar',
    delete: 'Borrar',
    close: 'Cerrar',
    loading: 'Cargando…',
    errorGeneric: 'Ha ocurrido un error',
    notFilled: 'Sin rellenar.',
    noBookTitle: 'Sin libro',
    noBookMessage: 'Crea un libro en la pestaña Libros para empezar.',
    choosePlaceholder: 'Elegir…',
    searchPlaceholder: 'Buscar…',
    noMatch: (query: string) => `Nada coincide con “${query}”.`,
  },

  roles: {
    PROTAGONIST: 'Protagonista',
    ANTAGONIST: 'Antagonista',
    SECONDARY: 'Secundario',
    EXTRA: 'Figurante',
  },

  tabs: {
    books: 'Libros',
    plot: 'Trama',
    characters: 'Personajes',
    chapters: 'Capítulos',
    settings: 'Ajustes',
    characterDetail: 'Ficha',
    chapterDetail: 'Capítulo',
  },

  unsaved: {
    default: 'Hay cambios sin guardar. Si sales ahora se perderán.',
    alertTitle: 'Cambios sin guardar',
    keepEditing: 'Seguir editando',
    discard: 'Descartar',
  },

  books: {
    editTitle: 'Editar libro',
    newTitle: 'Nuevo libro',
    fieldTitle: 'Título',
    titlePlaceholder: 'El nombre de tu novela',
    fieldAuthor: 'Autor',
    authorPlaceholder: 'Quién la escribe',
    fieldSynopsis: 'Sinopsis',
    synopsisHint: 'De qué va, en un párrafo',
    exportedAlertTitle: 'Exportado',
    exportedAlertBody: (uri: string) => `Guardado en:\n${uri}`,
    exportDialogTitle: (title: string) => `Exportar "${title}"`,
    invalidJson: 'El fichero no es un JSON válido',
    importedAlertTitle: 'Importado',
    importedAlertBody: (title: string) => `"${title}" ya está en el dispositivo.`,
    confirmDeleteTitle: 'Borrar libro',
    confirmDeleteBody: (title: string) =>
      `¿Borrar "${title}"? Se perderán sus personajes, capítulos y toda su trama. No se puede deshacer.`,
    title: 'Libros',
    newBook: '+ Libro',
    importJson: 'Importar JSON',
    importing: 'Importando…',
    empty: 'Todavía no hay libros. Crea el primero para empezar.',
    active: 'Activo',
    charactersLabel: (n: number) => `${n} personajes`,
    chaptersLabel: (n: number) => `${n} capítulos`,
    eventsLabel: (n: number) => `${n} sucesos`,
    activate: 'Activar',
    export: 'Exportar',
  },

  characters: {
    count: (n: number) => (n === 1 ? '1 personaje' : `${n} personajes`),
    newCharacter: '+ Personaje',
    empty: 'Todavía no hay personajes en este libro.',
    newSheetTitle: 'Nuevo personaje',
    fieldName: 'Nombre',
    namePlaceholder: 'Cómo se llama',
    fieldRole: 'Rol',
  },

  characterDetail: {
    notFound: 'Personaje no encontrado.',
    confirmDeleteTitle: 'Borrar personaje',
    confirmDeleteBody: (name: string) => `¿Borrar a ${name}? Se perderán su arco y sus relaciones.`,
    unsavedMessage: 'Hay cambios sin guardar en este personaje. Si sales ahora se perderán.',
    sectionPhysical: 'Descripción física',
    sectionPersonality: 'Personalidad',
    sectionBackstory: 'Historia previa',
    sectionPersonalPlot: 'Trama personal',
    sectionArc: 'Arco',
    sectionRelationships: 'Relaciones',
    sectionNotes: 'Notas',
    editTitle: 'Editar personaje',
    fieldAge: 'Edad',
    agePlaceholder: 'unos cuarenta',
    fieldPhysical: 'Descripción física',
    fieldPersonality: 'Personalidad',
    fieldBackstory: 'Historia previa',
    backstoryHint: 'Lo que le ocurrió ANTES de empezar el libro',
    fieldPersonalPlot: 'Trama personal',
    personalPlotHint: 'Lo que le OCURRE durante el libro',
    fieldArcSummary: 'Resumen del arco',
    arcSummaryHint: 'Cómo CAMBIA por dentro',
    fieldNotes: 'Notas',

    arcEmpty:
      'Sin etapas. Divide el arco en momentos: punto de partida, detonante, crisis, transformación.',
    editArc: 'Editar arco',
    addStages: 'Añadir etapas',
    stageTitlePlaceholder: 'Título de la etapa',
    stageDescriptionPlaceholder: 'Qué ocurre en esta etapa',
    removeStage: 'Quitar',
    addStage: '+ Etapa',
    saveArc: 'Guardar arco',

    relationshipsEmpty: 'Sin relaciones.',
    addRelationship: '+ Relación',
    needsAnotherCharacter: 'Necesitas otro personaje en el libro.',
    newRelationshipTitle: 'Nueva relación',
    adding: 'Añadiendo…',
    add: 'Añadir',
    fieldRelatedCharacter: 'Personaje',
    relatedCharacterPlaceholder: 'Elige un personaje…',
    fieldRelationType: 'Es su…',
    relationTypePlaceholder: 'hermano, rival, mentor',
    reciprocalLabel: (relatedName: string | undefined) =>
      `Cómo ${relatedName ? `te ve ${relatedName}` : 'te ve él/ella'} (opcional)`,
    reciprocalHint: 'Déjalo vacío para no crear la inversa. Puede ser otro texto, p.ej. "hermana".',
    reciprocalPlaceholder: 'hermana, discípulo, enemiga',
  },

  chapters: {
    count: (n: number) => (n === 1 ? '1 capítulo' : `${n} capítulos`),
    reorder: 'Reordenar',
    newChapter: '+ Capítulo',
    saveOrder: 'Guardar orden',
    empty: 'Todavía no hay capítulos en este libro.',
    castCount: (n: number) => (n === 1 ? '1 personaje' : `${n} personajes`),
    newSheetTitle: 'Nuevo capítulo',
    fieldTitle: 'Título',
    titlePlaceholder: 'Cómo se llama el capítulo',
    fieldSynopsis: 'Sinopsis',
    synopsisHint: 'Qué ocurre en el capítulo',
  },

  chapterDetail: {
    notFound: 'Capítulo no encontrado.',
    confirmDeleteTitle: 'Borrar capítulo',
    confirmDeleteBody: (title: string) => `¿Borrar "${title}"? Se perderán su texto y su reparto.`,
    unsavedMessage: 'Hay cambios sin guardar en este capítulo. Si sales ahora se perderán.',
    position: (n: number) => `Capítulo ${n}`,
    sectionSynopsis: 'Sinopsis',
    sectionCast: 'Reparto',
    sectionText: 'Texto',
    sectionNotes: 'Notas',
    editTitle: 'Editar capítulo',
    fieldTitle: 'Título',
    fieldSynopsis: 'Sinopsis',
    synopsisHint: 'Qué ocurre en el capítulo',
    fieldNotes: 'Notas',

    panelLabelField: 'Rótulo del panel',
    textPlaceholder: 'Escribe aquí el capítulo…',
    words: (n: number) => `${n} palabras`,
    unsavedBadge: 'Cambios sin guardar',
    saveText: 'Guardar texto',

    castEmpty: 'Nadie asignado. Añade quién sale y qué hace.',
    editCast: 'Editar reparto',
    addCast: 'Añadir reparto',
    removeFromCast: 'Quitar',
    castActionPlaceholder: 'Qué hace en este capítulo',
    unnamedCharacter: 'Personaje',
    addCharacterField: 'Añadir personaje',
    addCharacterPlaceholder: '+ Añadir personaje…',
    saveCast: 'Guardar reparto',
  },

  plot: {
    eventsSectionTitle: (n: number) => `Sucesos — ${n}`,
    reorder: 'Reordenar',
    newEvent: '+ Suceso',
    saveOrder: 'Guardar orden',
    eventsEmpty: 'Todavía no hay sucesos en la trama.',
    seedBadge: (title: string) => `siembra: ${title}`,
    payoffBadge: (title: string) => `paga: ${title}`,

    confirmDeleteEventTitle: 'Borrar suceso',
    confirmDeleteEventBody: (title: string, parts: string[]) =>
      `¿Borrar "${title}"?${parts.length ? ` ${parts.join(' y ')}.` : ''}`,
    seededWillBeLost: (n: number) => `se perderán ${n} promesa(s) sembrada(s) aquí`,
    paidWillReturn: (n: number) => `${n} promesa(s) pagada(s) aquí volverán a pendiente`,

    promisesSectionTitle: (pending: number, total: number) => `Promesas — ${pending} de ${total} sin pagar`,
    newPromise: '+ Promesa',
    needsAnEvent: 'Necesitas al menos un suceso para crear una promesa.',
    promisesEmpty: 'Sin promesas todavía.',
    pendingGroup: 'Pendientes',
    fulfilledGroup: 'Cumplidas',
    seededAt: (position: number, title: string) => `Se siembra en #${position} · ${title}`,
    paidAt: (position: number, title: string) => `paga en #${position} · ${title}`,
    pendingBadge: 'pendiente',
    outOfOrderBadge: 'se paga antes de sembrarse',
    confirmDeletePromiseTitle: 'Borrar promesa',
    confirmDeletePromiseBody: (title: string) => `¿Borrar "${title}"?`,

    newEventTitle: 'Nuevo suceso',
    editEventTitle: 'Editar suceso',
    fieldEventTitle: 'Título',
    eventTitlePlaceholder: 'Qué ocurre',
    fieldDescription: 'Descripción',

    newPromiseTitle: 'Nueva promesa',
    editPromiseTitle: 'Editar promesa',
    fieldPromiseTitle: 'Título',
    promiseTitlePlaceholder: 'Qué se promete al lector',
    fieldSetupEvent: 'Se siembra en',
    setupEventPlaceholder: 'Elige el suceso…',
    fieldPayoffEvent: 'Se paga en',
    payoffEventHint: 'Déjalo en «Pendiente» si todavía no se paga',
    payoffPendingOption: '— Pendiente —',
  },

  settings: {
    title: 'Ajustes',
    themeLabel: 'Tema',
    themeLight: 'Claro',
    themeDark: 'Oscuro',
    themeSystem: 'Sistema',
    languageLabel: 'Idioma',
    // Los nombres de idioma se muestran siempre en su propio idioma
    // (endónimos), para que se reconozcan aunque la UI esté en otro.
    languageEs: 'Español',
    languageEn: 'English',
    languageFr: 'Français',
    aboutLabel: 'Sobre la aplicación',
    rateApp: 'Valorar la aplicación',
    privacyPolicy: 'Ver la política de privacidad y las condiciones de uso',
    showWalkthrough: 'Ver el tutorial otra vez',
    linkErrorTitle: 'No se pudo abrir el enlace',
    linkErrorBody: (url: string) => `Ábrelo a mano en el navegador:\n\n${url}`,
  },

  walkthrough: {
    title: 'Cómo funciona Taledesk',
    stepOf: (current: number, total: number) => `Paso ${current} de ${total}`,
    back: 'Atrás',
    next: 'Siguiente',
    done: 'Empezar',
    dontShowAgain: 'No mostrar de nuevo',
    steps: [
      {
        icon: '📚',
        title: 'Empieza por un libro',
        body: 'Todo cuelga de un libro: créalo en la pestaña Libros con su título, autor y sinopsis. El libro que elijas ahí es el que verán las demás pestañas.',
      },
      {
        icon: '🧵',
        title: 'Ordena la trama',
        body: 'En Trama colocas los sucesos clave en el orden en que ocurren y anotas las promesas que le haces al lector: qué se plantea y en qué suceso se resuelve.',
      },
      {
        icon: '👥',
        title: 'Da forma a los personajes',
        body: 'Cada personaje tiene rol, físico, personalidad, trasfondo, su arco por etapas y las relaciones con los demás. La trama es lo que le pasa; el arco, cómo cambia por dentro.',
      },
      {
        icon: '📖',
        title: 'Planifica los capítulos',
        body: 'Ordena los capítulos, asigna a cada uno su reparto y escribe en dos paneles de texto independientes: por ejemplo un borrador y su revisión.',
      },
      {
        icon: '💾',
        title: 'Tus datos son tuyos',
        body: 'Todo se guarda en este dispositivo, sin cuenta ni conexión. Desde Libros puedes exportar cualquier libro como fichero JSON para tener una copia o pasarlo a otro dispositivo.',
      },
    ],
  },

  exit: {
    title: 'Salir de Taledesk',
    message: '¿Quieres cerrar la aplicación?',
    confirm: 'Salir',
    cancel: 'Seguir aquí',
  },

  app: {
    openingLibrary: 'Abriendo la biblioteca…',
  },
};

// Deliberadamente SIN `as const`: eso congelaría cada string a su valor
// literal exacto (p.ej. el tipo de `cancel` sería `'Cancelar'`, no `string`),
// y `en.ts` no podría asignarle `'Cancel'`. Sin él, TypeScript infiere los
// leafs como `string` normal y las funciones por su firma — que es
// justo la forma que necesita `Dict`.
export type Dict = typeof es;
