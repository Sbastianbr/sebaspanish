(() => {
  const languageSelector = document.querySelector("#languageSelector");
  const languageButton = document.querySelector("#languageButton");
  const languageCode = document.querySelector("#currentLanguage");
  const languageOptions = document.querySelectorAll(".navbar__language-option");
  const storageKey = "sebaspanish-language";
  const translations = {
    en: {
      dele_book: "Book DELE preparation",
      dele_title: "Prepare for your",
      dele_title_accent: "DELE exam",
      dele_intro:
        "Build your exam skills with a plan tailored to your level, guided practice and authentic materials.",
      dele_level_heading: "Which level are you preparing for?",
      dele_includes: "What does the preparation include?",
      dele_diagnosis: "Initial assessment",
      dele_diagnosis_text:
        "We identify your starting point and the areas to focus on.",
      dele_plan: "Personalised plan",
      dele_plan_text: "Preparation shaped around your level, goals and pace.",
      dele_comprehension: "Reading and listening",
      dele_comprehension_text:
        "We work with texts and audio, exploring how to approach each task.",
      dele_writing: "Writing",
      dele_writing_text:
        "We improve your writing with corrections and practical feedback.",
      dele_speaking: "Speaking",
      dele_speaking_text:
        "We practise speaking tasks to help you express yourself clearly and confidently.",
      dele_mock: "Mock exams",
      dele_mock_text:
        "We practise the format and timing, then review how it went together.",
      classes_start: "How would you like to",
      classes_advance: "improve",
      classes_end: "your Spanish?",
      classes_intro: "Choose the option that suits you best.",
      classes_private: "One-to-one Spanish",
      classes_private_text:
        "Personalised lessons for travel, work, study, meeting people or getting by with more confidence.",
      classes_conversation: "Conversation from day one",
      classes_tailored: "Lessons fully tailored to you",
      classes_real: "Spanish for real-life situations",
      classes_progress: "Goals and progress at your own pace",
      classes_plans: "View one-to-one plans",
      classes_exam_label: "YOUR GOAL: THE EXAM",
      classes_dele: "DELE preparation",
      classes_dele_text:
        "Prepare for the exam with guided practice, mock exams and personalised corrections.",
      classes_diagnostic: "Initial assessment and study plan",
      classes_reading: "Reading and listening comprehension",
      classes_speaking: "Writing and speaking",
      classes_mock: "Mock exams",
      classes_feedback: "Corrections and detailed feedback",
      classes_dele_cta: "Prepare for my DELE",
      classes_notice:
        "Independent preparation for the DELE exam. SebaSpanish is not affiliated with Instituto Cervantes.",
      classes_one_to_one: "One-to-one lessons",
      classes_attention: "Personal attention",
      classes_online: "100% online",
      classes_anywhere: "From anywhere",
      classes_flexible: "Flexible scheduling",
      classes_when: "You choose when",
      classes_real_progress: "Real progress",
      classes_confidence: "Speak with confidence",
      plans_title_start: "Choose the plan that",
      plans_title_end: "suits you best",
      plans_intro:
        "Start with a trial lesson or choose the plan that best fits your pace.",
      trial_label: "FIRST SESSION",
      trial_title: "Trial lesson",
      trial_text:
        "We get to know your level, discuss your goals and see how we can work together.",
      trial_duration: "30 minutes",
      trial_free: "Free",
      trial_cta: "Book a trial lesson",
      plan_single_label: "SINGLE LESSON",
      plan_single_title: "1 lesson",
      plan_single_rate: "65 zł / lesson",
      plan_single_text: "Work on a specific goal, one lesson at a time.",
      plan_single_duration: "One 60-minute individual lesson",
      plan_material: "Personalised material",
      plan_flexible: "Flexible lesson times",
      plan_goals: "Support with your goals",
      plan_single_cta: "Choose 1 lesson",
      plan_recommended: "RECOMMENDED",
      plan_pack: "PACKAGE",
      plan_four_title: "4 lessons",
      plan_four_rate: "57.50 zł / lesson",
      plan_separate: "booked separately",
      plan_four_saving: "Save 30 zł",
      plan_four_text: "Make steady progress and work towards your goals.",
      plan_four_duration: "4 individual 60-minute lessons",
      plan_tailored: "A plan tailored to your goals",
      plan_practice: "Materials to practise between lessons",
      plan_progress: "Progress tracking",
      plan_four_cta: "Choose 4 lessons",
      plan_best: "BEST PRICE / LESSON",
      plan_eight_title: "8 lessons",
      plan_eight_rate: "55 zł / lesson",
      plan_eight_saving: "Save 80 zł",
      plan_eight_text: "Keep your momentum and make long-term progress.",
      plan_eight_duration: "8 individual 60-minute lessons",
      plan_eight_included: "Everything included in the 4-lesson package",
      plan_continuity: "More continuity in your learning",
      plan_long_term: "Long-term goals and progress",
      plan_eight_cta: "Choose 8 lessons",
      use_heading: "What do you want to use your Spanish for?",
      use_intro: "Whatever your goal, the lessons adapt to you.",
      use_travel: "On a trip",
      use_travel_text: "Travel with more confidence.",
      use_work: "At work",
      use_work_text: "Communicate with your team, clients or colleagues.",
      use_connect: "Meeting new people",
      use_connect_text: "Meet, talk and build connections.",

      moment_usa_title: "The United States",
      moment_usa_text: "My first experience living and working outside Chile.",
      moment_usa_alt: "Sebastián working during his time in the United States",
      moment_budapest_title: "Budapest",
      moment_budapest_text: "Where my journey teaching Spanish began.",
      moment_budapest_alt:
        "Sebastián in Budapest in front of the Hungarian Parliament",
      moment_poland_title: "Poland",
      moment_poland_text:
        "I live here today and continue learning languages from the other side.",
      moment_poland_alt: "Sebastián during his current life in Poland",
      nav_classes: "Lessons",
      nav_plans: "Plans",
      nav_reviews: "Reviews",
      nav_faq: "FAQ",
      nav_about: "Meet Seba",
      nav_book: "Book your trial lesson",
      hero_title: "Speak Spanish",
      hero_title_accent: "with more confidence.",
      hero_description:
        "The Spanish you need to travel, work, meet people and express yourself more naturally.",
      hero_start: "View plans and prices",
      teacher_name: "I’m Sebastián.",
      teacher_role: "Your Spanish teacher.",
      training: "100 hours of ELE training",
      institute: "Instituto Cervantes in Budapest",
      bio_title: "A little about me",
      bio_first:
        "I’m Sebastián, I’m Chilean and I currently live in Poland. Before teaching Spanish, I also had to learn to get by in other languages while living in the United States, Hungary and now Poland.",
      bio_second:
        "I know what it feels like to struggle to find the right word, mispronounce something or be afraid of making mistakes. It was in Budapest that I decided to train as a Spanish teacher, and today I try to create the same atmosphere in my lessons that helped me:",
      bio_end: "practising, laughing at mistakes and building confidence.",
      bio_open: "Get to know me",
      bio_close: "Close biography",
      language_label: "Change language",
      home_label: "SebaSpanish - Home",
      nav_label: "Main navigation",
      photo_alt: "Sebastián, Spanish teacher",
      page_title: "SebaSpanish | Spanish lessons",
      use_abroad: "Living abroad",
      use_abroad_text: "Make Spanish part of your everyday life.",
    },
    pl: {
      dele_book: "Zarezerwuj przygotowanie do DELE",
      dele_title: "Przygotuj się do egzaminu",
      dele_title_accent: "DELE",
      dele_intro:
        "Rozwijamy umiejętności potrzebne na egzaminie dzięki planowi dopasowanemu do Twojego poziomu, ćwiczeniom z nauczycielem i autentycznym materiałom.",
      dele_level_heading: "Do jakiego poziomu się przygotowujesz?",
      dele_includes: "Co obejmuje przygotowanie?",
      dele_diagnosis: "Diagnoza początkowa",
      dele_diagnosis_text:
        "Sprawdzamy, od czego zaczynasz i nad czym warto popracować.",
      dele_plan: "Indywidualny plan",
      dele_plan_text:
        "Dopasowujemy przygotowanie do Twojego poziomu, celów i tempa.",
      dele_comprehension: "Czytanie i słuchanie ze zrozumieniem",
      dele_comprehension_text:
        "Ćwiczymy z tekstami i nagraniami oraz omawiamy, jak podejść do każdego zadania.",
      dele_writing: "Wypowiedź pisemna",
      dele_writing_text:
        "Pracujemy nad Twoimi tekstami, korzystając z korekty i konkretnych wskazówek.",
      dele_speaking: "Wypowiedź ustna",
      dele_speaking_text:
        "Ćwiczymy zadania ustne, aby łatwiej było Ci mówić jasno i z pewnością siebie.",
      dele_mock: "Egzaminy próbne",
      dele_mock_text:
        "Ćwiczymy w warunkach zbliżonych do egzaminu i wspólnie omawiamy wyniki.",
      classes_start: "Jak chcesz",
      classes_advance: "rozwijać",
      classes_end: "swój hiszpański?",
      classes_intro: "Wybierz opcję najlepiej dopasowaną do siebie.",
      classes_private: "Hiszpański indywidualnie",
      classes_private_text:
        "Indywidualne lekcje, które pomogą Ci podróżować, pracować, studiować, poznawać ludzi i czuć się pewniej.",
      classes_conversation: "Rozmowa od pierwszego dnia",
      classes_tailored: "Lekcje w pełni dopasowane do Ciebie",
      classes_real: "Hiszpański w codziennych sytuacjach",
      classes_progress: "Cele i postępy we własnym tempie",
      classes_plans: "Zobacz plany indywidualne",
      classes_exam_label: "CEL: TWÓJ EGZAMIN",
      classes_dele: "Przygotowanie do DELE",
      classes_dele_text:
        "Przygotuj się do egzaminu dzięki ćwiczeniom z nauczycielem, próbnym egzaminom i indywidualnej korekcie.",
      classes_diagnostic: "Diagnoza początkowa i plan nauki",
      classes_reading: "Rozumienie tekstu i ze słuchu",
      classes_speaking: "Wypowiedź pisemna i ustna",
      classes_mock: "Egzaminy próbne",
      classes_feedback: "Korekta i szczegółowa informacja zwrotna",
      classes_dele_cta: "Przygotuj się do DELE",
      classes_notice:
        "Niezależne przygotowanie do egzaminu DELE. SebaSpanish nie jest powiązany z Instytutem Cervantesa.",
      classes_one_to_one: "Lekcje indywidualne",
      classes_attention: "Indywidualne podejście",
      classes_online: "100% online",
      classes_anywhere: "Z dowolnego miejsca",
      classes_flexible: "Elastyczne godziny",
      classes_when: "Ty wybierasz kiedy",
      classes_real_progress: "Rzeczywiste postępy",
      classes_confidence: "Mów z pewnością siebie",
      plans_title_start: "Wybierz plan, który",
      plans_title_end: "najlepiej Ci odpowiada",
      plans_intro:
        "Zacznij od lekcji próbnej lub wybierz plan dopasowany do swojego tempa.",
      trial_label: "PIERWSZE SPOTKANIE",
      trial_title: "Lekcja próbna",
      trial_text:
        "Poznamy Twój poziom, porozmawiamy o celach i ustalimy, jak możemy razem pracować.",
      trial_duration: "30 minut",
      trial_free: "Bezpłatnie",
      trial_cta: "Zarezerwuj lekcję próbną",
      plan_single_label: "POJEDYNCZA LEKCJA",
      plan_single_title: "1 lekcja",
      plan_single_rate: "65 zł / lekcję",
      plan_single_text: "Pracuj nad konkretnym celem, lekcja po lekcji.",
      plan_single_duration: "Indywidualna lekcja trwająca 60 minut",
      plan_material: "Spersonalizowane materiały",
      plan_flexible: "Elastyczne godziny zajęć",
      plan_goals: "Monitorowanie Twoich celów",
      plan_single_cta: "Wybierz 1 lekcję",
      plan_recommended: "POLECANY",
      plan_pack: "PAKIET",
      plan_four_title: "4 lekcje",
      plan_four_rate: "57,50 zł / lekcję",
      plan_separate: "osobno",
      plan_four_saving: "Oszczędzasz 30 zł",
      plan_four_text: "Rób regularne postępy i realizuj swoje cele.",
      plan_four_duration: "4 indywidualne lekcje po 60 minut",
      plan_tailored: "Plan dopasowany do Twoich celów",
      plan_practice: "Materiały do ćwiczeń między lekcjami",
      plan_progress: "Monitorowanie postępów",
      plan_four_cta: "Wybierz 4 lekcje",
      plan_best: "NAJLEPSZA CENA / LEKCJĘ",
      plan_eight_title: "8 lekcji",
      plan_eight_rate: "55 zł / lekcję",
      plan_eight_saving: "Oszczędzasz 80 zł",
      plan_eight_text: "Utrzymaj rytm nauki i rób długofalowe postępy.",
      plan_eight_duration: "8 indywidualnych lekcji po 60 minut",
      plan_eight_included: "Wszystko, co zawiera pakiet 4 lekcji",
      plan_continuity: "Większa regularność nauki",
      plan_long_term: "Długofalowe cele i postępy",
      plan_eight_cta: "Wybierz 8 lekcji",
      use_heading: "Do czego chcesz używać hiszpańskiego?",
      use_intro: "Niezależnie od celu, lekcje dopasowujemy do Ciebie.",
      use_travel: "W podróży",
      use_travel_text: "Podróżuj z większą pewnością siebie.",
      use_work: "W pracy",
      use_work_text: "Rozmawiaj z zespołem, klientami i kolegami z pracy.",
      use_connect: "Wśród nowych ludzi",
      use_connect_text: "Poznawaj ludzi, rozmawiaj i buduj relacje.",

      moment_usa_title: "Stany Zjednoczone",
      moment_usa_text: "Moje pierwsze doświadczenie życia i pracy poza Chile.",
      moment_usa_alt:
        "Sebastián w pracy podczas swojego pobytu w Stanach Zjednoczonych",
      moment_budapest_title: "Budapeszt",
      moment_budapest_text:
        "To tutaj rozpoczęła się moja droga jako nauczyciela hiszpańskiego.",
      moment_budapest_alt:
        "Sebastián w Budapeszcie na tle gmachu węgierskiego parlamentu",
      moment_poland_title: "Polska",
      moment_poland_text:
        "Dziś tutaj mieszkam i nadal uczę się języków, będąc również uczniem.",
      moment_poland_alt: "Sebastián mieszkający obecnie w Polsce",
      nav_classes: "Lekcje",
      nav_plans: "Cennik",
      nav_reviews: "Opinie",
      nav_faq: "Pytania",
      nav_about: "Poznaj Sebę",
      nav_book: "Zarezerwuj lekcję próbną",
      hero_title: "Mów swobodniej",
      hero_title_accent: "po hiszpańsku.",
      hero_description:
        "Hiszpański, którego potrzebujesz, aby podróżować, pracować, poznawać ludzi i swobodniej radzić sobie w codziennych sytuacjach.",
      hero_start: "Zobacz plany i ceny",
      teacher_name: "Jestem Sebastián.",
      teacher_role: "Twój nauczyciel hiszpańskiego.",
      training: "100 godzin szkolenia ELE",
      institute: "Instytut Cervantesa w Budapeszcie",
      bio_title: "Kilka słów o mnie",
      bio_first:
        "Mam na imię Sebastián, pochodzę z Chile i obecnie mieszkam w Polsce. Zanim zacząłem uczyć hiszpańskiego, sam musiałem nauczyć się porozumiewać w innych językach, mieszkając w Stanach Zjednoczonych, na Węgrzech, a teraz w Polsce.",
      bio_second:
        "Wiem, jak to jest nie móc znaleźć odpowiedniego słowa, źle coś wymówić albo bać się popełnić błąd. To w Budapeszcie zdecydowałem się zdobyć przygotowanie do nauczania hiszpańskiego. Dziś na swoich lekcjach staram się tworzyć taką samą atmosferę, jaka pomogła mi: taką, w której można",
      bio_end: "ćwiczyć, śmiać się z błędów i nabierać pewności siebie.",
      bio_open: "Poznaj mnie bliżej",
      bio_close: "Zamknij biografię",
      language_label: "Zmień język",
      home_label: "SebaSpanish - Strona główna",
      nav_label: "Nawigacja główna",
      photo_alt: "Sebastián, nauczyciel hiszpańskiego",
      page_title: "SebaSpanish | Lekcje hiszpańskiego",
      use_abroad: "Życie za granicą",
      use_abroad_text: "Używaj hiszpańskiego także na co dzień.",
    },
  };
  // El español se toma del HTML original, conservando la biografía acordada.
  translations.es = {
    bio_open: "Conóceme un poco",
    bio_close: "Cerrar biografía",
    page_title: "SebaSpanish | Clases de español",
  };
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    translations.es[element.dataset.i18n] = element.textContent.trim();
  });
  for (const [data, attribute] of [
    ["i18nAria", "aria-label"],
    ["i18nAlt", "alt"],
  ]) {
    document
      .querySelectorAll(
        attribute === "alt" ? "[data-i18n-alt]" : "[data-i18n-aria]",
      )
      .forEach((element) => {
        translations.es[element.dataset[data]] =
          element.getAttribute(attribute);
      });
  }
  let currentLanguage = "es";
  const t = (key) => translations[currentLanguage][key] ?? translations.es[key];

  const card = document.querySelector("#tarjeta-seba");

  const aboutLinks = document.querySelectorAll('a[href="#tarjeta-seba"]');
  const toggle = card?.querySelector(".tarjeta-seba__toggle");
  const label = card?.querySelector(".tarjeta-seba__toggle-texto");
  const bio = card?.querySelector("#bio-seba");
  const message = document.querySelector(".presentacion__mensaje");
  const wideLayout = window.matchMedia("(min-width: 800px)");
  let biographyOpen = window.location.hash === "#tarjeta-seba";
  const renderBiography = () => {
    if (!card || !toggle || !bio || !label) return;
    card.classList.toggle("is-open", biographyOpen);
    toggle.setAttribute("aria-expanded", String(biographyOpen));
    bio.setAttribute("aria-hidden", String(!biographyOpen));
    bio.inert = !biographyOpen;
    // La expansión ocupa el mensaje en escritorio; no se enfoca contenido tapado.
    const hideMessage = wideLayout.matches && biographyOpen;
    if (message) {
      message.inert = hideMessage;
      message.setAttribute("aria-hidden", String(hideMessage));
    }
    label.textContent = t(biographyOpen ? "bio_close" : "bio_open");
  };

  toggle?.addEventListener("click", () => {
    biographyOpen = !biographyOpen;
    renderBiography();
  });
  aboutLinks.forEach((aboutLink) => {
    aboutLink.addEventListener("click", () => {
      biographyOpen = true;
      renderBiography();
      card?.focus({ preventScroll: true });
    });
  });
  wideLayout.addEventListener("change", renderBiography);

  const changeLanguage = (language) => {
    if (!Object.hasOwn(translations, language)) return;
    currentLanguage = language;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAria));
    });
    document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
      element.setAttribute("alt", t(element.dataset.i18nAlt));
    });
    document.documentElement.lang = language;
    document.title = t("page_title");
    if (languageCode) languageCode.textContent = language.toUpperCase();

    languageOptions.forEach((option) => {
      const isActive = option.dataset.language === language;

      option.classList.toggle("is-active", isActive);
      option.setAttribute("aria-checked", String(isActive));
    });
    renderBiography();
  };

  // Enlace real: también permite abrir la reserva DELE en una nueva pestaña.
  const deleBooking = document.querySelector("#dele-booking");
  const updateDeleBooking = () => {
    const level = document.querySelector(
      'input[name="dele-level"]:checked',
    )?.value;
    if (!deleBooking || !["A1", "A2", "B1", "B2", "C1", "C2"].includes(level))
      return;
    deleBooking.href =
      "reservar.html?" + new URLSearchParams({ tipo: "dele", nivel: level });
  };
  document.querySelectorAll('input[name="dele-level"]').forEach((radio) => {
    radio.addEventListener("change", updateDeleBooking);
  });
  updateDeleBooking();

  /* =========================================
   SELECTOR DE IDIOMA
========================================= */

  const languageMenu = document.querySelector("#languageMenu");
  const menuIsOpen = () =>
    languageButton?.getAttribute("aria-expanded") === "true";
  const closeLanguageMenu = () => {
    languageSelector?.classList.remove("is-open");
    languageButton?.setAttribute("aria-expanded", "false");
    if (languageMenu) languageMenu.inert = true;
  };
  const openLanguageMenu = (last = false) => {
    languageSelector?.classList.add("is-open");
    languageButton?.setAttribute("aria-expanded", "true");
    if (languageMenu) languageMenu.inert = false;
    const selected = [...languageOptions].find(
      (o) => o.dataset.language === currentLanguage,
    );
    (last
      ? languageOptions[languageOptions.length - 1]
      : selected || languageOptions[0]
    )?.focus();
  };
  languageButton?.addEventListener("click", () => {
    if (menuIsOpen()) closeLanguageMenu();
    else openLanguageMenu();
  });
  languageButton?.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    openLanguageMenu(event.key === "ArrowUp");
  });
  languageMenu?.addEventListener("keydown", (event) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const items = [...languageOptions];
    const index = items.indexOf(document.activeElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length;
    items[next]?.focus();
  });
  languageOptions.forEach((option) => {
    option.addEventListener("click", () => {
      changeLanguage(option.dataset.language);
      try {
        localStorage.setItem(storageKey, currentLanguage);
      } catch {
        /* El idioma funciona aunque el almacenamiento esté desactivado. */
      }
      closeLanguageMenu();
      languageButton?.focus({ preventScroll: true });
    });
  });
  languageSelector?.addEventListener("focusout", (event) => {
    if (!languageSelector.contains(event.relatedTarget)) closeLanguageMenu();
  });
  document.addEventListener("click", (event) => {
    if (!languageSelector?.contains(event.target)) closeLanguageMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (menuIsOpen()) {
      event.preventDefault();
      closeLanguageMenu();
      languageButton?.focus({ preventScroll: true });
    } else if (biographyOpen && card?.contains(document.activeElement)) {
      event.preventDefault();
      biographyOpen = false;
      renderBiography();
      toggle?.focus({ preventScroll: true });
    }
  });

  // La altura real varía con el ancho, las fuentes y el idioma.
  const navbar = document.querySelector(".navbar");
  if (navbar) {
    const updateNavbarHeight = () =>
      document.documentElement.style.setProperty(
        "--navbar-height",
        `${Math.ceil(navbar.getBoundingClientRect().height)}px`,
      );
    updateNavbarHeight();
    new ResizeObserver(updateNavbarHeight).observe(navbar);
  }
  closeLanguageMenu();
  let savedLanguage = "es";
  try {
    savedLanguage = localStorage.getItem(storageKey) || "es";
  } catch {
    /* El español es la opción inicial sin almacenamiento. */
  }
  changeLanguage(
    Object.hasOwn(translations, savedLanguage) ? savedLanguage : "es",
  );

  // Sin JavaScript, la foto y la biografía permanecen disponibles.
  if (card && toggle && bio && label) {
    card.classList.add("is-interactive");
    toggle.hidden = false;
    renderBiography();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => card.classList.add("is-ready"));
    });
  }
})();

/* =========================================
   REVEAL Y ATMÓSFERA ENTRE SECCIONES
========================================= */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const revealElements = document.querySelectorAll(
    ".clases__cabecera, .clases__caminos, .planes__header, .planes__trial, .planes__grid, .dele__container, .opiniones__header, .opiniones__grid, .faq__header, .faq__list",
  );
  let revealObserver;

  const show = (element) => element.classList.add("is-visible");
  const syncReveal = () => {
    revealObserver?.disconnect();
    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      revealElements.forEach((element) => {
        element.classList.remove("reveal");
        show(element);
      });
      return;
    }
    revealObserver ??= new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          // Se rearma fuera de pantalla, sin desvanecer contenido en lectura.
          if (isIntersecting || target.contains(document.activeElement))
            show(target);
          else target.classList.remove("is-visible");
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
    );
    revealElements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      // Evita ocultar la sección de entrada al cargar un enlace con ancla.
      element.classList.toggle(
        "is-visible",
        (rect.bottom >= -64 && rect.top <= window.innerHeight + 64) ||
          element.contains(document.activeElement),
      );
      element.classList.add("reveal");
      revealObserver.observe(element);
    });
  };
  syncReveal();

  reduceMotion.addEventListener("change", syncReveal);

  document.addEventListener("focusin", (event) => {
    const target = event.target.closest(".reveal");
    if (target) show(target);
  });

  // Cualquier sección posterior a DELE vuelve al fondo general automáticamente.
  const ambientZones = [...document.querySelectorAll("main > section")].map(
    (element) => ({
      element,
      className: element.matches(".dele")
        ? "ambient--dele"
        : element.matches(".planes, .opiniones")
          ? "ambient--warm"
          : "ambient--base",
    }),
  );
  const ambientClasses = ["ambient--base", "ambient--warm", "ambient--dele"];
  const ambientTrigger = 0.55;
  let currentAmbient;
  let frame = 0;
  let geometryDirty = true;
  let viewportHeight = window.innerHeight;

  const updateAtmosphere = () => {
    frame = 0;
    const scrollY = window.scrollY;
    // Solo se recalculan posiciones si cambia el contenido o el viewport.
    if (geometryDirty) {
      viewportHeight = window.innerHeight;
      ambientZones.forEach((zone) => {
        zone.top = zone.element.getBoundingClientRect().top + scrollY;
      });
      geometryDirty = false;
    }
    const readingPosition = scrollY + viewportHeight * ambientTrigger;
    let nextAmbient = "ambient--base";
    ambientZones.forEach((zone) => {
      if (zone.top <= readingPosition) nextAmbient = zone.className;
    });
    if (nextAmbient !== currentAmbient) {
      document.body.classList.remove(...ambientClasses);
      document.body.classList.add(nextAmbient);
      currentAmbient = nextAmbient;
    }
  };
  const requestUpdate = () => {
    if (!frame) frame = requestAnimationFrame(updateAtmosphere);
  };
  const invalidateGeometry = () => {
    geometryDirty = true;
    requestUpdate();
  };
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", invalidateGeometry);
  window.addEventListener("pageshow", invalidateGeometry);
  window.addEventListener("load", invalidateGeometry, { once: true });
  if ("ResizeObserver" in window) {
    const layoutObserver = new ResizeObserver(invalidateGeometry);
    ambientZones.forEach((zone) => layoutObserver.observe(zone.element));
  }
  document.fonts?.ready.then(invalidateGeometry);
  updateAtmosphere();
})();

(() => {
  const modal = document.querySelector("#testimonio-modal");

  if (!modal) return;

  const video = modal.querySelector(".testimonio-modal__video");
  const title = modal.querySelector(".testimonio-modal__title");
  const closeButton = modal.querySelector(".testimonio-modal__close");
  const backdrop = modal.querySelector(".testimonio-modal__backdrop");

  const subtitleButtons = modal.querySelectorAll("[data-subtitle-lang]");
  let opener;
  let backgroundElements = [];
  let subtitleLanguage = "es";

  const setSubtitleLanguage = (language) => {
    subtitleLanguage = language;
    Array.from(video.textTracks).forEach((track) => {
      track.mode = track.language === language ? "showing" : "disabled";
    });

    subtitleButtons.forEach((button) => {
      const selected = button.dataset.subtitleLang === language;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  };

  const openModal = (button) => {
    const videoSrc = button.dataset.testimonioVideo;
    const subtitleEs = button.dataset.testimonioEs;
    const subtitleEn = button.dataset.testimonioEn;
    const nombre = button.dataset.testimonioNombre;

    video.pause();
    video.innerHTML = "";

    const source = document.createElement("source");
    source.src = videoSrc;
    source.type = "video/mp4";
    video.appendChild(source);

    if (subtitleEs) {
      const trackEs = document.createElement("track");

      trackEs.src = subtitleEs;
      trackEs.kind = "subtitles";
      trackEs.srclang = "es";
      trackEs.label = "Español";

      video.appendChild(trackEs);
    }

    if (subtitleEn) {
      const trackEn = document.createElement("track");

      trackEn.src = subtitleEn;
      trackEn.kind = "subtitles";
      trackEn.srclang = "en";
      trackEn.label = "English";

      video.appendChild(trackEn);
    }

    title.textContent = `Testimonio de ${nombre}`;

    setSubtitleLanguage("es");

    video.load();

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");
    opener = button;
    backgroundElements = Array.from(document.body.children)
      .filter((element) => element !== modal && element.tagName !== "SCRIPT")
      .map((element) => ({ element, inert: element.inert }));
    backgroundElements.forEach(({ element }) => { element.inert = true; });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (modal.classList.contains("is-open")) closeButton.focus({ preventScroll: true });
    }));
  };

  const closeModal = () => {
    if (!modal.classList.contains("is-open")) return;
    video.pause();
    video.currentTime = 0;

    backgroundElements.forEach(({ element, inert }) => { element.inert = inert; });
    backgroundElements = [];
    opener?.focus({ preventScroll: true });
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };

  document.querySelectorAll("[data-testimonio-video]").forEach((button) => {
    button.addEventListener("click", () => {
      openModal(button);
    });
  });

  subtitleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setSubtitleLanguage(button.dataset.subtitleLang);
    });
  });

  // One listener per video, even if it is closed before metadata finishes loading.
  video.addEventListener("loadedmetadata", () => setSubtitleLanguage(subtitleLanguage));
  closeButton.addEventListener("click", closeModal);

  backdrop.addEventListener("click", closeModal);

  document.addEventListener("keydown", (event) => {
    if (!modal.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
    } else if (event.key === "Tab") {
      const controls = Array.from(modal.querySelectorAll("button, video[controls]"));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
})();

// ==========================================
// FAQ / ACORDEÓN
// ==========================================
(() => {
  const faqItems = document.querySelectorAll(".faq__item");

  if (!faqItems.length) return;

  const setExpanded = (item, expanded) => {
    item.classList.toggle("is-open", expanded);
    item.querySelector(".faq__question")?.setAttribute("aria-expanded", String(expanded));
    const answer = item.querySelector(".faq__answer");
    if (answer) {
      answer.setAttribute("aria-hidden", String(!expanded));
      answer.inert = !expanded;
    }
  };

  faqItems.forEach((item) => {
    const button = item.querySelector(".faq__question");
    if (!button) return;
    setExpanded(item, item.classList.contains("is-open"));
    button.addEventListener("click", () => {
      const shouldOpen = !item.classList.contains("is-open");
      faqItems.forEach((otherItem) => setExpanded(otherItem, otherItem === item && shouldOpen));
    });
  });
})();
