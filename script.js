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
        "We practise the exam format and timing, then review the results together.",
      classes_start: "How would you like to",
      classes_advance: "improve",
      classes_end: "your Spanish?",
      classes_intro: "Choose the option that suits you best.",
      classes_private: "Spanish 1 to 1",
      classes_private_text:
        "Personalised lessons for travel, work, study, meeting people or getting by with more confidence.",
      classes_conversation: "Conversation from day one",
      classes_tailored: "Lessons fully tailored to you",
      classes_real: "Spanish for real-life situations",
      classes_progress: "Goals and progress at your own pace",
      classes_plans: "View 1-to-1 plans",
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
      classes_when: "Choose from available times",
      classes_real_progress: "Real progress",
      classes_confidence: "Goals tailored to you",
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
      plan_material: "Personalised materials",
      plan_flexible: "Flexible lesson times",
      plan_goals: "Tracking your goals",
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
      use_heading: "How will you use Spanish?",
      use_intro: "Whatever your goal, the lessons adapt to you.",
      use_travel: "Travelling",
      use_travel_text: "Travel with more confidence.",
      use_work: "At work",
      use_work_text: "Communicate with your team, clients or colleagues.",
      use_connect: "With new people",
      use_connect_text: "Meet, talk and build connections.",
      moment_usa_title: "United States",
      moment_usa_text: "My first experience living and working outside Chile.",
      moment_usa_alt: "Sebastián working during his time in the United States",
      moment_budapest_title: "Budapest",
      moment_budapest_text: "Where my journey teaching Spanish began.",
      moment_budapest_alt:
        "Sebastián in Budapest in front of the Hungarian Parliament",
      moment_poland_title: "Poland",
      moment_poland_text:
        "I live here now and keep learning languages as a student, too.",
      moment_poland_alt: "Sebastián during his current life in Poland",
      nav_plans: "Plans",
      nav_reviews: "Reviews",
      nav_faq: "FAQ",
      nav_about: "Meet Seba",
      nav_my_classes: "My lessons",
      nav_book: "Book your trial lesson",
      hero_title: "Speak Spanish",
      hero_title_accent: "with more confidence",
      hero_description:
        "We practise real-life situations to help you feel more at ease speaking and build confidence step by step.",
      hero_start: "View plans and prices",
      teacher_name: "I’m Sebastián.",
      teacher_role: "Your Spanish teacher.",
      training: "100 hours of ELE training",
      institute: "Instituto Cervantes in Budapest",
      bio_title: "A little about me",
      bio_first:
        "I’m Sebastián, I’m Chilean and I currently live in Poland. Before teaching Spanish, I also had to learn to get by in other languages while living abroad: first in the United States, then Hungary and now Poland.",
      bio_second:
        "I know what it’s like to go blank, mispronounce something or be afraid of making mistakes. I began training as a Spanish teacher in Budapest. Today, I try to create an atmosphere in my lessons where",
      bio_end: "you can practise, laugh at mistakes and build confidence.",
      bio_open: "Get to know me",
      bio_close: "Close biography",
      language_label: "Change language",
      home_label: "SebaSpanish - Home",
      nav_label: "Main navigation",
      photo_alt: "Sebastián, Spanish teacher",
      page_title: "SebaSpanish | Online Spanish lessons",
      use_abroad: "Living abroad",
      use_abroad_text: "Make Spanish part of your everyday life.",
      faq_eyebrow: "Before you start",
      faq_title: "Frequently asked",
      faq_title_accent: "questions",
      faq_intro:
        "Everything you need to know about lessons, bookings, payments and DELE preparation.",
      faq_q1: "What is the first lesson like?",
      faq_a1:
        "The trial lesson lasts 30 minutes and is free. It gives us a chance to get to know each other, discuss your goals and see which lessons would suit you best.",
      faq_q2: "Where do lessons take place?",
      faq_a2:
        "All lessons take place online by video call, so you can join from anywhere. When you book, you’ll receive the details you need to join your lesson.",
      faq_q3: "How do payments work?",
      faq_a3:
        "Before confirming your booking, you can review your chosen plan, the price and your lesson details. Available payment methods will be shown during the booking process.",
      faq_q4: "What if I need to reschedule or cancel a lesson?",
      faq_a4:
        "If you need to reschedule or cancel a lesson, you can request a change under the SebaSpanish booking terms. The conditions and deadlines will be shown before you confirm your booking.",
      faq_q5: "Do I need to know my Spanish level?",
      faq_a5:
        "No. If you’re not sure of your level yet, we’ll work it out together and adapt the lessons to your starting point, goals and pace.",
      faq_q6: "How does DELE preparation work?",
      faq_a6:
        "We work on the exam skills for your level: reading and listening comprehension, writing and speaking, corrections and mock exams. SebaSpanish preparation is independent of Instituto Cervantes.",
      faq_q7: "How do I book a lesson and choose a time?",
      faq_a7:
        "Choose your lesson type or plan, select an available time and enter your details. You can review all your booking information before confirming.",
      faq_q8: "How long are lessons and how do packages work?",
      faq_a8:
        "Regular lessons last 60 minutes. You can book a single lesson or choose a package of 4 or 8 lessons, depending on how regularly you’d like to learn.",
      reviews_title: "What my",
      reviews_title_accent: "students say",
      reviews_intro:
        "Real experiences from students who have learned Spanish with me from around the world.",
      review_video: "VIDEO",
      review_watch: "Watch testimonial",
      review_pia:
        "“He’s an excellent teacher. He’s thorough and goes through the information with you.”",
      review_michal:
        "“I’m learning Spanish with Sebastián and he is a very good teacher.”",
      review_ron:
        "“Sebastián makes the lessons easy to follow and creates a comfortable space to practice speaking. I feel more confident in Spanish after every class.”",
      review_placeholder: "“A real testimonial will appear here.”",
      review_placeholder_istvan:
        "“István’s real testimonial will appear here.”",
      placeholder_name: "Name",
      placeholder_country: "Country",
      country_bahamas: "Bahamas",
      country_hungary: "Hungary",
      country_chile: "Chile",
      review_modal_title: "Testimonial from {name}",
      review_close: "Close video",
      review_subtitles: "Subtitle language",
      footer_socials: "Social media",
      footer_instagram: "SebaSpanish on Instagram",
      footer_facebook: "SebaSpanish on Facebook",
      footer_tiktok: "SebaSpanish on TikTok",
      footer_legal: "Legal information",
      footer_privacy: "Privacy policy",
      footer_terms: "Terms and conditions",
      footer_cancellations: "Changes and cancellations",
      footer_nav_label: "Footer navigation",
      footer_explore: "Explore",
      footer_more: "More",
      footer_copyright: "© 2026 SebaSpanish. All rights reserved.",
      footer_tagline: "Online Spanish lessons, one to one",
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
        "Ćwiczymy format egzaminu i pracę w wyznaczonym czasie, a potem wspólnie omawiamy wyniki.",
      classes_start: "Jak chcesz",
      classes_advance: "rozwijać",
      classes_end: "swój hiszpański?",
      classes_intro: "Wybierz opcję najlepiej dopasowaną do siebie.",
      classes_private: "Hiszpański 1 na 1",
      classes_private_text:
        "Indywidualne lekcje, które pomogą Ci podróżować, pracować, studiować, poznawać ludzi i czuć się pewniej.",
      classes_conversation: "Rozmowa od pierwszego dnia",
      classes_tailored: "Lekcje w pełni dopasowane do Ciebie",
      classes_real: "Hiszpański w codziennych sytuacjach",
      classes_progress: "Cele i postępy we własnym tempie",
      classes_plans: "Zobacz pakiety 1 na 1",
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
      classes_when: "Wybierz dostępny termin",
      classes_real_progress: "Realne postępy",
      classes_confidence: "Cele dopasowane do Ciebie",
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
      plan_material: "Materiały dopasowane do Ciebie",
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
      use_heading: "Do czego przyda Ci się hiszpański?",
      use_intro: "Niezależnie od celu, lekcje dopasowujemy do Ciebie.",
      use_travel: "W podróży",
      use_travel_text: "Podróżuj z większą pewnością siebie.",
      use_work: "W pracy",
      use_work_text: "Rozmawiaj z zespołem, klientami i kolegami z pracy.",
      use_connect: "Nowe znajomości",
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
        "Dziś tu mieszkam i nadal uczę się języków — także jako uczeń.",
      moment_poland_alt: "Sebastián mieszkający obecnie w Polsce",
      nav_plans: "Cennik",
      nav_reviews: "Opinie",
      nav_faq: "Pytania",
      nav_about: "Poznaj Sebę",
      nav_my_classes: "Moje lekcje",
      nav_book: "Zarezerwuj lekcję próbną",
      hero_title: "Mów swobodniej",
      hero_title_accent: "po hiszpańsku",
      hero_description:
        "Ćwiczymy sytuacje z życia, żeby łatwiej było Ci mówić i stopniowo nabierać pewności siebie.",
      hero_start: "Zobacz plany i ceny",
      teacher_name: "Jestem Sebastián.",
      teacher_role: "Twój nauczyciel hiszpańskiego.",
      training: "100 godzin szkolenia ELE",
      institute: "Instytut Cervantesa w Budapeszcie",
      bio_title: "Kilka słów o mnie",
      bio_first:
        "Mam na imię Sebastián, pochodzę z Chile i obecnie mieszkam w Polsce. Zanim zacząłem uczyć hiszpańskiego, sam musiałem nauczyć się porozumiewać w innych językach, żyjąc poza Chile — najpierw w Stanach Zjednoczonych, potem na Węgrzech, a teraz w Polsce.",
      bio_second:
        "Wiem, jak to jest zapomnieć, co się chciało powiedzieć, źle coś wymówić albo bać się popełnić błąd. W Budapeszcie zacząłem przygotowywać się do pracy nauczyciela hiszpańskiego. Dziś staram się tworzyć na lekcjach atmosferę, w której",
      bio_end: "możesz ćwiczyć, śmiać się z błędów i nabierać pewności siebie.",
      bio_open: "Poznaj mnie bliżej",
      bio_close: "Zamknij biografię",
      language_label: "Zmień język",
      home_label: "SebaSpanish - Strona główna",
      nav_label: "Nawigacja główna",
      photo_alt: "Sebastián, nauczyciel hiszpańskiego",
      page_title: "SebaSpanish | Hiszpański online",
      use_abroad: "Życie za granicą",
      use_abroad_text: "Używaj hiszpańskiego także na co dzień.",
      faq_eyebrow: "Zanim zaczniesz",
      faq_title: "Najczęstsze",
      faq_title_accent: "pytania",
      faq_intro:
        "Wszystko, co warto wiedzieć o lekcjach, rezerwacjach, płatnościach i przygotowaniu do DELE.",
      faq_q1: "Jak wygląda pierwsza lekcja?",
      faq_a1:
        "Lekcja próbna trwa 30 minut i jest bezpłatna. To okazja, żeby się poznać, porozmawiać o Twoich celach i ustalić, jakie zajęcia będą dla Ciebie najlepsze.",
      faq_q2: "Gdzie odbywają się lekcje?",
      faq_a2:
        "Wszystkie lekcje odbywają się online przez wideorozmowę, więc możesz dołączyć z dowolnego miejsca. Po rezerwacji otrzymasz informacje potrzebne do udziału w lekcji.",
      faq_q3: "Jak wyglądają płatności?",
      faq_a3:
        "Przed potwierdzeniem rezerwacji możesz sprawdzić wybrany pakiet, cenę i szczegóły lekcji. Dostępne metody płatności zobaczysz podczas rezerwacji.",
      faq_q4: "Co zrobić, jeśli muszę przełożyć lub odwołać lekcję?",
      faq_a4:
        "Jeśli potrzebujesz przełożyć lub odwołać lekcję, możesz zgłosić taką prośbę zgodnie z zasadami rezerwacji SebaSpanish. Warunki i terminy zostaną podane przed potwierdzeniem rezerwacji.",
      faq_q5: "Czy muszę znać swój poziom hiszpańskiego?",
      faq_a5:
        "Nie. Jeśli nie znasz jeszcze swojego poziomu, sprawdzimy go razem i dopasujemy lekcje do Twoich umiejętności, celów i tempa nauki.",
      faq_q6: "Jak wygląda przygotowanie do DELE?",
      faq_a6:
        "Pracujemy nad umiejętnościami wymaganymi na Twoim poziomie egzaminu: czytaniem i słuchaniem ze zrozumieniem, pisaniem i mówieniem. Korzystamy z korekty prac i egzaminów próbnych. SebaSpanish prowadzi przygotowanie niezależnie od Instytutu Cervantesa.",
      faq_q7: "Jak zarezerwować lekcję i wybrać termin?",
      faq_a7:
        "Wybierz rodzaj lekcji lub pakiet, zaznacz jeden z dostępnych terminów i uzupełnij dane. Przed potwierdzeniem możesz sprawdzić wszystkie informacje o rezerwacji.",
      faq_q8: "Ile trwają lekcje i jak działają pakiety?",
      faq_a8:
        "Standardowe lekcje trwają 60 minut. Możesz zarezerwować pojedynczą lekcję albo wybrać pakiet 4 lub 8 zajęć, zależnie od tego, jak regularnie chcesz się uczyć.",
      reviews_title: "Co mówią",
      reviews_title_accent: "moi uczniowie",
      reviews_intro:
        "Prawdziwe doświadczenia osób z różnych zakątków świata, które uczyły się ze mną hiszpańskiego.",
      review_video: "WIDEO",
      review_watch: "Obejrzyj opinię",
      review_pia:
        "“Jest świetnym nauczycielem. Jest dokładny i omawia z Tobą materiał.”",
      review_michal:
        "“Uczę się hiszpańskiego z Sebastianem i jest bardzo dobrym nauczycielem.”",
      review_placeholder: "“Tutaj pojawi się prawdziwa opinia.”",
      review_placeholder_istvan: "“Tutaj pojawi się prawdziwa opinia Istvána.”",
      placeholder_name: "Imię",
      placeholder_country: "Kraj",
      country_bahamas: "Bahamy",
      country_hungary: "Węgry",
      country_chile: "Chile",
      review_modal_title: "Opinia: {name}",
      review_close: "Zamknij film",
      review_subtitles: "Język napisów",
      footer_socials: "Media społecznościowe",
      footer_instagram: "SebaSpanish na Instagramie",
      footer_facebook: "SebaSpanish na Facebooku",
      footer_tiktok: "SebaSpanish na TikToku",
      footer_legal: "Informacje prawne",
      footer_privacy: "Polityka prywatności",
      footer_terms: "Regulamin",
      footer_cancellations: "Zmiany i odwołania",
      footer_nav_label: "Nawigacja w stopce",
      footer_explore: "Odkryj",
      footer_more: "Więcej",
      footer_copyright: "© 2026 SebaSpanish. Wszelkie prawa zastrzeżone.",
      footer_tagline: "Hiszpański online — lekcje 1 na 1",
    },
  };
  // El español se toma del HTML original, conservando la biografía acordada.
  translations.es = {
    bio_open: "Conóceme un poco",
    bio_close: "Cerrar biografía",
    page_title: "SebaSpanish | Clases de español online",
    review_modal_title: "Testimonio de {name}",
  };
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    if (element.dataset.i18n !== "review_modal_title") {
      translations.es[element.dataset.i18n] = element.textContent.trim();
    }
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
  // Translate only the existing text node when a label also contains an icon/accent.
  const ownText = Array.from(document.querySelectorAll("[data-i18n-own]")).map(
    (element) => {
      const node = Array.from(element.childNodes).find(
        (child) =>
          child.nodeType === Node.TEXT_NODE && child.textContent.trim(),
      );
      const suffix = element.dataset.i18nSuffix || "";
      const original = node.textContent;
      translations.es[element.dataset.i18nOwn] = original
        .trim()
        .slice(0, suffix ? -suffix.length : undefined);
      return { element, node, original, suffix };
    },
  );
  let currentLanguage = "es";
  const t = (key) => translations[currentLanguage][key] ?? translations.es[key];

  const card = document.querySelector("#tarjeta-seba");

  const aboutLinks = document.querySelectorAll('a[href="#tarjeta-seba"]');
  const toggle = card?.querySelector(".tarjeta-seba__toggle");
  const label = card?.querySelector(".tarjeta-seba__toggle-texto");
  const bio = card?.querySelector("#bio-seba");
  const message = document.querySelector(".presentacion__mensaje");
  const wideLayout = window.matchMedia("(min-width: 800px)");
  let biographyOpen = false;
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

  const translateContent = () => {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n).replace(
        "{name}",
        element.dataset.i18nName || "",
      );
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAria));
    });
    document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
      element.setAttribute("alt", t(element.dataset.i18nAlt));
    });
    ownText.forEach(({ element, node, original, suffix }) => {
      node.textContent =
        currentLanguage === "es"
          ? original
          : original.match(/^\s*/)[0] +
            t(element.dataset.i18nOwn) +
            suffix +
            original.match(/\s*$/)[0];
    });
  };
  document.addEventListener("sebaspanish:translate", translateContent);

  const changeLanguage = (language) => {
    if (!Object.hasOwn(translations, language)) return;
    currentLanguage = language;
    translateContent();
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

    title.dataset.i18nName = nombre;
    document.dispatchEvent(new Event("sebaspanish:translate"));

    setSubtitleLanguage("es");

    video.load();

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");
    opener = button;
    backgroundElements = Array.from(document.body.children)
      .filter((element) => element !== modal && element.tagName !== "SCRIPT")
      .map((element) => ({ element, inert: element.inert }));
    backgroundElements.forEach(({ element }) => {
      element.inert = true;
    });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (modal.classList.contains("is-open"))
          closeButton.focus({ preventScroll: true });
      }),
    );
  };

  const closeModal = () => {
    if (!modal.classList.contains("is-open")) return;
    video.pause();
    video.currentTime = 0;

    backgroundElements.forEach(({ element, inert }) => {
      element.inert = inert;
    });
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
  video.addEventListener("loadedmetadata", () =>
    setSubtitleLanguage(subtitleLanguage),
  );
  closeButton.addEventListener("click", closeModal);

  backdrop.addEventListener("click", closeModal);

  document.addEventListener("keydown", (event) => {
    if (!modal.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
    } else if (event.key === "Tab") {
      const controls = Array.from(
        modal.querySelectorAll("button, video[controls]"),
      );
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
    item
      .querySelector(".faq__question")
      ?.setAttribute("aria-expanded", String(expanded));
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
      faqItems.forEach((otherItem) =>
        setExpanded(otherItem, otherItem === item && shouldOpen),
      );
    });
  });
})();
