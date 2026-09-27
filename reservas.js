import {
  OFFERS,
  LEVELS,
  addDays,
  dateInZone,
  timeInZone,
  parseSelection,
  offerFor,
  indexAvailability,
  loadAvailability,
  prepareBooking,
} from "./reservas-data.js?v=20260925-2";

(() => {
  "use strict";

  const copy = {
    step5: ["Listo", "Done", "Gotowe"],
    unavailable: [
      "La agenda aún no está conectada. Todavía no hay horarios reales para reservar.",
      "The calendar is not connected yet. There are no real booking times available.",
      "Kalendarz nie jest jeszcze połączony. Nie ma jeszcze rzeczywistych terminów do rezerwacji.",
    ],
    tryDemo: [
      "Probar flujo de demostración",
      "Try the demo flow",
      "Wypróbuj wersję demonstracyjną",
    ],
    exitDemo: ["Salir de la demostración", "Exit demo", "Wyjdź z demonstracji"],
    loading: [
      "Consultando horarios…",
      "Loading available times…",
      "Wczytywanie dostępnych godzin…",
    ],
    loadError: [
      "No se pudieron cargar los horarios. Inténtalo de nuevo.",
      "Times could not be loaded. Please try again.",
      "Nie udało się wczytać godzin. Spróbuj ponownie.",
    ],
    retry: ["Volver a consultar", "Try again", "Spróbuj ponownie"],
    delePending: [
      "Los planes, precios y horarios DELE se definirán por separado. Puedes seleccionar tu nivel; la reserva DELE aún no está habilitada.",
      "DELE plans, prices and availability will be defined separately. You can select your level; DELE booking is not available yet.",
      "Plany, ceny i terminy DELE zostaną ustalone osobno. Możesz wybrać poziom; rezerwacja DELE nie jest jeszcze dostępna.",
    ],
    pricePending: ["Por definir", "To be defined", "Do ustalenia"],
    language: [
      "Idioma de contacto",
      "Preferred contact language",
      "Język kontaktu",
    ],
    chooseLanguage: [
      "Selecciona un idioma",
      "Choose a language",
      "Wybierz język",
    ],
    otherLanguage: ["Otro", "Other", "Inny"],
    languageError: [
      "Selecciona el idioma en el que prefieres que te contactemos.",
      "Choose your preferred contact language.",
      "Wybierz preferowany język kontaktu.",
    ],
    sessions: ["Número de clases", "Number of lessons", "Liczba lekcji"],
    memoryNote: [
      "Esta demostración solo permanece en esta pantalla. No se ha enviado ni guardado ningún dato.",
      "This demo only remains on this screen. No details have been sent or saved.",
      "Ta demonstracja pozostaje tylko na tym ekranie. Żadne dane nie zostały wysłane ani zapisane.",
    ],
    submitting: ["Preparando…", "Preparing…", "Przygotowywanie…"],
    submissionError: [
      "No se pudo preparar el resumen. Revisa el horario e inténtalo de nuevo.",
      "The summary could not be prepared. Check the time and try again.",
      "Nie udało się przygotować podsumowania. Sprawdź termin i spróbuj ponownie.",
    ],
    slotsCount: [
      "Horarios disponibles:",
      "Available times:",
      "Dostępne godziny:",
    ],
    title: ["Reserva tu clase", "Book your lesson", "Zarezerwuj lekcję"],
    titleStart: ["Reserva tu", "Book your", "Zarezerwuj"],
    titleAccent: ["clase", "lesson", "lekcję"],
    intro: [
      "Elige la opción que mejor encaja contigo.",
      "Choose the option that suits you best.",
      "Wybierz opcję najlepiej dopasowaną do siebie.",
    ],
    home: ["Volver a planes", "Back to plans", "Powrót do planów"],
    step1: ["Clase", "Lesson", "Lekcja"],
    step2: ["Horario", "Schedule", "Termin"],
    step3: ["Tus datos", "Your details", "Twoje dane"],
    step4: ["Revisar", "Review", "Podsumowanie"],
    steps: ["Pasos de la reserva", "Booking steps", "Etapy rezerwacji"],
    serviceTitle: ["Elige tu clase", "Choose your lesson", "Wybierz lekcję"],
    type: ["Tipo de clase", "Lesson type", "Rodzaj lekcji"],
    prueba: ["Clase de prueba", "Trial lesson", "Lekcja próbna"],
    "1a1": ["Español 1 a 1", "One-to-one Spanish", "Hiszpański 1 na 1"],
    dele: ["Preparación DELE", "DELE preparation", "Przygotowanie do DELE"],
    deleLevel: ["Nivel DELE", "DELE level", "Poziom DELE"],
    chooseLevel: ["Selecciona tu nivel", "Select your level", "Wybierz poziom"],
    plan: ["Plan", "Plan", "Plan"],
    plan1: ["1 clase", "1 lesson", "1 lekcja"],
    plan4: ["Pack de 4 clases", "4-lesson package", "Pakiet 4 lekcji"],
    plan8: ["Pack de 8 clases", "8-lesson package", "Pakiet 8 lekcji"],
    recommended: ["RECOMENDADO", "RECOMMENDED", "POLECANY"],
    best: [
      "MEJOR PRECIO / CLASE",
      "BEST PRICE / LESSON",
      "NAJLEPSZA CENA / LEKCJĘ",
    ],
    packNote: [
      "Ahora reservamos la primera sesión de tu pack. Las siguientes se acordarán después.",
      "You are scheduling the first session of your package. The remaining sessions will be arranged later.",
      "Teraz wybierasz termin pierwszej lekcji z pakietu. Pozostałe ustalimy później.",
    ],
    chooseSchedule: ["Elegir horario", "Choose a time", "Wybierz termin"],
    dayTitle: ["Elige un día", "Choose a day", "Wybierz dzień"],
    demo: [
      "Disponibilidad de demostración. Estos horarios todavía no están conectados a una agenda real.",
      "Demo availability. These times are not yet connected to a real calendar.",
      "Przykładowa dostępność. Terminy nie są jeszcze połączone z rzeczywistym kalendarzem.",
    ],
    zoneHelp: [
      "Los horarios se muestran automáticamente en tu hora local.",
      "Times are automatically shown in your local time.",
      "Godziny są automatycznie wyświetlane w Twoim czasie lokalnym.",
    ],
    changeZone: [
      "Cambiar zona horaria",
      "Change time zone",
      "Zmień strefę czasową",
    ],
    hideZone: ["Ocultar selector", "Hide selector", "Ukryj wybór strefy"],
    selectZone: [
      "Selecciona tu zona horaria",
      "Select your time zone",
      "Wybierz swoją strefę czasową",
    ],
    previousMonth: ["Mes anterior", "Previous month", "Poprzedni miesiąc"],
    nextMonth: ["Mes siguiente", "Next month", "Następny miesiąc"],
    timeTitle: ["Elige una hora", "Choose a time", "Wybierz godzinę"],
    selectDay: [
      "Selecciona un día para ver los horarios.",
      "Select a day to see the times.",
      "Wybierz dzień, aby zobaczyć godziny.",
    ],
    noSlots: [
      "No hay horarios disponibles para este día.",
      "No times are available for this day.",
      "Brak dostępnych godzin w tym dniu.",
    ],
    back: ["Volver", "Back", "Wstecz"],
    continue: ["Continuar", "Continue", "Dalej"],
    studentTitle: ["Tus datos", "Your details", "Twoje dane"],
    required: [
      "* Campos obligatorios. Tus datos no se enviarán en esta versión.",
      "* Required fields. Your details will not be sent in this version.",
      "* Pola wymagane. W tej wersji Twoje dane nie zostaną wysłane.",
    ],
    name: ["Nombre", "Name", "Imię"],
    email: ["Email", "Email", "Email"],
    phone: [
      "WhatsApp / teléfono (opcional)",
      "WhatsApp / phone (optional)",
      "WhatsApp / telefon (opcjonalnie)",
    ],
    country: ["País (opcional)", "Country (optional)", "Kraj (opcjonalnie)"],
    spanishLevel: [
      "Nivel actual de español (opcional)",
      "Current Spanish level (optional)",
      "Obecny poziom hiszpańskiego (opcjonalnie)",
    ],
    unknown: ["No lo sé todavía", "I am not sure yet", "Jeszcze nie wiem"],
    message: [
      "Mensaje / objetivo (opcional)",
      "Message / goal (optional)",
      "Wiadomość / cel (opcjonalnie)",
    ],
    review: ["Revisar reserva", "Review booking", "Sprawdź rezerwację"],
    reviewTitle: [
      "Revisa tu reserva",
      "Review your booking",
      "Sprawdź swoją rezerwację",
    ],
    localNote: [
      "Esta es una vista previa: no se reserva ninguna plaza, no se cobra y no se envía ningún email.",
      "This is a preview: no place is reserved, no payment is taken and no email is sent.",
      "To podgląd: żaden termin nie zostanie zarezerwowany, nie pobierzemy płatności ani nie wyślemy emaila.",
    ],
    confirm: ["Preparar reserva", "Prepare booking", "Przygotuj rezerwację"],
    successTitle: [
      "Tu vista previa está lista",
      "Your booking preview is ready",
      "Podgląd Twojej rezerwacji jest gotowy",
    ],
    successNote: [
      "Esta es una demostración: no se ha bloqueado ningún horario, realizado ningún pago, enviado ningún email ni guardado una reserva.",
      "This is a demo: no time has been held, no payment has been taken, no email has been sent and no booking has been saved.",
      "To demonstracja: nie zablokowano terminu, nie pobrano płatności, nie wysłano emaila ani nie zapisano rezerwacji.",
    ],
    backHome: [
      "Volver a SebaSpanish",
      "Back to SebaSpanish",
      "Powrót do SebaSpanish",
    ],
    edit: ["Editar borrador", "Edit draft", "Edytuj wersję roboczą"],
    summaryTitle: [
      "Resumen de tu reserva",
      "Your booking summary",
      "Podsumowanie Twojej rezerwacji",
    ],
    total: ["Total", "Total", "Razem"],
    preview: [
      "Vista previa · Sin pago ni reserva real",
      "Preview · No payment or real booking",
      "Podgląd · Bez płatności i rzeczywistej rezerwacji",
    ],
    free: ["Gratis", "Free", "Bezpłatnie"],
    minutes: ["minutos", "minutes", "minut"],
    perLesson: ["/ clase", "/ lesson", "/ lekcję"],
    duration: [
      "Duración de la sesión",
      "Session duration",
      "Czas trwania lekcji",
    ],
    date: ["Día", "Date", "Data"],
    time: ["Hora", "Time", "Godzina"],
    timezone: ["Tu zona horaria", "Your time zone", "Twoja strefa czasowa"],
    pending: ["Por elegir", "Not selected", "Do wyboru"],
    firstSession: [
      "Sesión del pack",
      "Session in your package",
      "Lekcja z pakietu",
    ],
    chooseOfferError: [
      "Selecciona un plan y, para DELE, el nivel que preparas.",
      "Choose a plan and, for DELE, your exam level.",
      "Wybierz plan, a w przypadku DELE także poziom egzaminu.",
    ],
    chooseTimeError: [
      "Selecciona un día y una hora disponibles para continuar.",
      "Select an available day and time to continue.",
      "Wybierz dostępny dzień i godzinę, aby kontynuować.",
    ],
    expired: [
      "Ese horario ya no cumple la antelación mínima. Elige otro para continuar.",
      "That time is now too soon to book. Please choose another time.",
      "Ten termin jest już zbyt bliski. Wybierz inny, aby kontynuować.",
    ],
    nameError: ["Escribe tu nombre.", "Enter your name.", "Wpisz swoje imię."],
    emailError: [
      "Escribe un email válido, por ejemplo nombre@dominio.com.",
      "Enter a valid email, for example name@example.com.",
      "Wpisz poprawny email, np. imie@example.com.",
    ],
    formError: [
      "Revisa los campos señalados.",
      "Check the highlighted fields.",
      "Sprawdź zaznaczone pola.",
    ],
  };

  const root = document.querySelector(".booking");
  if (!root) return;
  const $ = (selector) => root.querySelector(selector);
  const state = {
    ...parseSelection(window.location.search),
    step: 1,
    date: null,
    startAt: null,
    availabilitySource: "unconnected",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    student: {
      name: "",
      email: "",
      phone: "",
      language: "",
      country: "",
      spanishLevel: "",
      message: "",
    },
  };
  let availability = indexAvailability(
    { source: "unconnected", slots: [] },
    state.timezone,
    offerFor(state),
  );
  let availabilityStatus = "idle";
  let requestVersion = 0;
  let submitting = false;
  let month = availability.today.slice(0, 7);

  let formSubmitted = false;
  let feedbackKey = "";
  const language = () =>
    ["es", "en", "pl"].includes(document.documentElement.lang)
      ? document.documentElement.lang
      : "es";
  const t = (key) => copy[key][["es", "en", "pl"].indexOf(language())];
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const money = (price) =>
    price === 0
      ? t("free")
      : new Intl.NumberFormat(language(), {
          minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
          maximumFractionDigits: 2,
        }).format(price) + " zł";
  const formatDate = (date, options = { dateStyle: "long" }) =>
    new Intl.DateTimeFormat(language(), { ...options, timeZone: "UTC" }).format(
      new Date(date + "T12:00:00Z"),
    );
  const planLabel = () =>
    state.type === "dele"
      ? t("pricePending")
      : state.type === "prueba"
        ? t("prueba")
        : state.plan
          ? t("plan" + state.plan)
          : t("pending");
  const validService = () =>
    Boolean(offerFor(state)) &&
    (state.type !== "dele" || LEVELS.includes(state.deleLevel));
  const validSlot = () =>
    availability.slots
      .get(state.date)
      ?.some((slot) => slot.startAt === state.startAt && slot.available);
  function feedback(key = "") {
    feedbackKey = key;
    $("#booking-feedback").textContent = key ? t(key) : "";
  }
  function syncURL() {
    const url = new URL(window.location.href);
    ["tipo", "plan", "nivel"].forEach((key) => url.searchParams.delete(key));
    url.searchParams.set("tipo", state.type);
    if (state.plan) url.searchParams.set("plan", String(state.plan));
    if (state.deleLevel) url.searchParams.set("nivel", state.deleLevel);
    // Nunca se incluyen datos personales ni fechas en la URL.
    window.history.replaceState(null, "", url);
  }
  function details(includeStudent = false) {
    const offer = offerFor(state);
    const rows = [[t("type"), t(state.type)]];

    if (state.type === "1a1") {
      rows.push([t("plan"), planLabel()]);
    }
    if (state.type === "dele")
      rows.push([t("deleLevel"), state.deleLevel || t("pending")]);
    if (offer) {
      if (includeStudent && state.type !== "prueba") {
        rows.push([t("sessions"), String(offer.sessions)]);
      }

      rows.push([t("duration"), `${offer.durationMinutes} ${t("minutes")}`]);
    }
    if (state.plan > 1) rows.push([t("firstSession"), `1 / ${state.plan}`]);
    rows.push([t("date"), state.date ? formatDate(state.date) : t("pending")]);
    rows.push([
      t("time"),
      state.startAt
        ? timeInZone(state.startAt, state.timezone, language())
        : t("pending"),
    ]);
    rows.push([t("timezone"), state.timezone]);
    if (includeStudent) {
      rows.push([t("total"), offer ? money(offer.price) : t("pending")]);
      for (const [key, value] of Object.entries(state.student)) {
        if (value.trim())
          rows.push([
            t(key),
            key === "language"
              ? {
                  es: "Español",
                  en: "English",
                  pl: "Polski",
                  other: t("otherLanguage"),
                }[value]
              : value.trim(),
          ]);
      }
    }
    return rows
      .map(
        ([label, value]) =>
          `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`,
      )
      .join("");
  }
  function renderSummary() {
    renderTimezone();
    const offer = offerFor(state);
    $("#booking-summary").innerHTML = details();
    $("#booking-price").textContent = offer
      ? money(offer.price)
      : t("pricePending");
    $("#booking-rate").textContent =
      offer && state.type !== "prueba"
        ? `${money(offer.price / offer.sessions)} ${t("perLesson")}`
        : "";
    const fullSummary = details(true);
    $("#booking-review").innerHTML = fullSummary;
    $("#booking-result").innerHTML = fullSummary;
  }
  function renderService() {
    root.dataset.type = state.type;
    $("#booking-types").innerHTML = ["prueba", "1a1", "dele"]
      .map(
        (type) =>
          `<label class="booking-choice"><input type="radio" name="booking-type" value="${type}" ${state.type === type ? "checked" : ""}><span>${escape(t(type))}</span></label>`,
      )
      .join("");
    $("#booking-level").hidden = state.type !== "dele";
    $("#booking-dele-level").value = state.deleLevel || "";
    $("#booking-plans-fieldset").hidden = state.type !== "1a1";
    $("#booking-dele-note").hidden = state.type !== "dele";
    $("#service-next").disabled = state.type === "dele" && !offerFor(state);
    $("#booking-plans").innerHTML = [1, 4, 8]
      .map((plan) => {
        const offer = OFFERS[plan];
        const badge =
          plan === 1
            ? ""
            : `<span class="booking-badge">${escape(t(plan === 4 ? "recommended" : "best"))}</span>`;
        const planClass = plan === 8 ? " booking-plan--best" : "";
        return `<label class="booking-choice${planClass}"><input type="radio" name="booking-plan" value="${plan}" ${state.plan === plan ? "checked" : ""}><span class="booking-plan-copy">${badge}<strong>${escape(t("plan" + plan))}</strong><small>${plan} × ${offer.durationMinutes} ${escape(t("minutes"))}</small></span><span class="booking-plan-price">${escape(money(offer.price))}<small>${escape(money(offer.price / plan))} ${escape(t("perLesson"))}</small></span></label>`;
      })
      .join("");
    $("#booking-pack-note").hidden = !(state.plan > 1);
    $("#student-dele").hidden = state.type !== "dele";
    $("#student-dele").textContent =
      `${t("deleLevel")}: ${state.deleLevel || t("pending")}`;
  }
  function renderCalendar() {
    $("#calendar-month").textContent = formatDate(month + "-01", {
      month: "long",
      year: "numeric",
    });
    $("#month-prev").disabled = month <= availability.today.slice(0, 7);
    $("#month-next").disabled = month >= availability.lastDay.slice(0, 7);
    $("#month-prev").setAttribute("aria-label", t("previousMonth"));
    $("#month-next").setAttribute("aria-label", t("nextMonth"));
    $("#calendar-weekdays").innerHTML = Array.from(
      { length: 7 },
      (_, i) =>
        `<span>${escape(formatDate(addDays("2024-01-01", i), { weekday: "short" }))}</span>`,
    ).join("");
    const first = new Date(month + "-01T12:00:00Z");
    const offset = (first.getUTCDay() + 6) % 7;
    const days = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const cells = Array.from(
      { length: offset },
      () => '<span aria-hidden="true"></span>',
    );
    for (let day = 1; day <= days; day++) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const enabled =
        availabilityStatus === "ready" &&
        availability.slots.get(date)?.some((slot) => slot.available);
      cells.push(
        `<button type="button" class="booking-day" data-date="${date}" aria-label="${escape(formatDate(date, { dateStyle: "full" }))}" aria-pressed="${date === state.date}" ${date === availability.today ? 'aria-current="date"' : ""} ${enabled ? "" : "disabled"}>${day}</button>`,
      );
    }
    $("#calendar-days").innerHTML = cells.join("");
    renderSlots();
  }
  function renderSlots() {
    const slots =
      availabilityStatus === "ready"
        ? availability.slots.get(state.date) || []
        : [];
    $("#slot-hint").hidden = Boolean(state.date && slots.length);
    $("#slot-hint").textContent = t(state.date ? "noSlots" : "selectDay");
    $("#booking-slots").innerHTML = slots
      .map(
        (slot) =>
          `<button type="button" class="booking-slot" data-slot="${slot.startAt}" aria-pressed="${slot.startAt === state.startAt}" ${slot.available ? "" : "disabled"}>${escape(timeInZone(slot.startAt, state.timezone, language()))}</button>`,
      )
      .join("");
    $("#schedule-next").disabled =
      availabilityStatus !== "ready" || !validSlot();
    $("#slot-status").textContent = state.date
      ? `${t("slotsCount")} ${slots.length}`
      : "";
  }
  function validateStudent(focusInvalid = false) {
    const invalid = [];
    for (const key of ["name", "email", "language"]) {
      const input = $("#student-" + key);
      const value = state.student[key].trim();
      const valid =
        value.length > 0 &&
        input.validity.valid &&
        (key !== "language" || ["es", "en", "pl", "other"].includes(value)) &&
        (key !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
      input.setAttribute("aria-invalid", String(!valid));
      $("#" + key + "-error").textContent = valid ? "" : t(key + "Error");
      if (!valid) invalid.push(input);
    }
    if (focusInvalid && invalid.length) invalid[0].focus();
    return invalid.length === 0;
  }
  function renderTimezone() {
    // Intl proporciona nombres localizados, sin una base manual de ciudades.
    // El offset refleja la sesión elegida (incluido el cambio de hora).
    const instant = new Date(
      state.startAt || (state.date ? state.date + "T12:00:00Z" : Date.now()),
    );
    const zonePart = (style) =>
      new Intl.DateTimeFormat(language(), {
        timeZone: state.timezone,
        timeZoneName: style,
      })
        .formatToParts(instant)
        .find((part) => part.type === "timeZoneName")?.value;
    let label = state.timezone;
    try {
      const name = zonePart("longGeneric");
      const offset = zonePart("shortOffset");
      // Si Intl solo devuelve un offset, conservar el ID IANA como referencia.
      const readable =
        name && !/^(GMT|UTC)([+−-]|$)/.test(name) ? name : state.timezone;
      label = offset ? readable + " (" + offset + ")" : state.timezone;
    } catch {
      /* Un navegador sin este formato conserva el ID IANA. */
    }
    $("#booking-zone-value").textContent = label;
    $("#booking-zone-value").title = state.timezone;
    $("#booking-zone-toggle").textContent = t(
      $("#booking-zone-editor").hidden ? "changeZone" : "hideZone",
    );
  }
  function toggleZone(open) {
    $("#booking-zone-editor").hidden = !open;
    $("#booking-zone-toggle").setAttribute("aria-expanded", String(open));
    renderTimezone();
    $(open ? "#booking-zone" : "#booking-zone-toggle").focus();
  }
  function render() {
    document.title = `${t("title")} | SebaSpanish`;
    root.querySelectorAll("[data-booking-text]").forEach((el) => {
      el.textContent = t(el.dataset.bookingText);
    });
    const steps = $("#booking-steps");
    steps.setAttribute("aria-label", t("steps"));
    steps.innerHTML = [1, 2, 3, 4, 5]
      .map(
        (step) =>
          `<li ${state.step === step ? 'aria-current="step"' : ""}><span aria-hidden="true">${state.step > step ? "✓" : step}</span>${escape(t("step" + step))}</li>`,
      )
      .join("");
    root.querySelectorAll("[data-step]").forEach((el) => {
      el.hidden = Number(el.dataset.step) !== state.step;
    });
    renderService();
    renderAvailabilityStatus();
    renderCalendar();
    renderSummary();
    $("#booking-storage").textContent = state.step === 5 ? t("memoryNote") : "";
    if (formSubmitted) validateStudent();
    feedback(feedbackKey);
  }
  function goTo(step) {
    state.step = step;
    feedback();
    render();
    const heading = $(`[data-step="${step}"] h2`);
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  // Cada consulta tiene versión: una respuesta antigua nunca reemplaza la actual.
  function renderAvailabilityStatus() {
    const key =
      availabilityStatus === "loading"
        ? "loading"
        : availabilityStatus === "error"
          ? "loadError"
          : state.availabilitySource === "demo"
            ? "demo"
            : "unavailable";
    $("#availability-status").textContent = t(key);
    $("#booking-calendar-region").setAttribute(
      "aria-busy",
      String(availabilityStatus === "loading"),
    );
    $("#booking-demo").textContent = t(
      state.availabilitySource === "demo" ? "exitDemo" : "tryDemo",
    );
    $("#availability-retry").hidden = availabilityStatus !== "error";
    $("#booking-confirm").disabled = submitting;
    root.querySelectorAll('[data-step="4"] [data-back]').forEach((button) => {
      button.disabled = submitting;
    });
    $("#booking-confirm").textContent = t(
      submitting ? "submitting" : "confirm",
    );
  }
  async function loadSchedule() {
    const version = ++requestVersion;
    availabilityStatus = "loading";
    renderAvailabilityStatus();
    renderCalendar();
    try {
      const result = await loadAvailability({ ...state });
      if (version !== requestVersion) return false;
      availability = result;
      availabilityStatus = "ready";
      if (!validSlot()) state.startAt = null;
      if (!availability.slots.has(state.date)) state.date = null;
      month = (
        state.date ||
        [...availability.slots.keys()].sort()[0] ||
        availability.today
      ).slice(0, 7);
      renderAvailabilityStatus();
      renderCalendar();
      renderSummary();
      return true;
    } catch {
      if (version !== requestVersion) return false;
      availability = indexAvailability(
        { source: state.availabilitySource, slots: [] },
        state.timezone,
        offerFor(state),
      );
      availabilityStatus = "error";
      state.date = null;
      state.startAt = null;
      renderAvailabilityStatus();
      renderCalendar();
      renderSummary();
      return false;
    }
  }
  async function refreshSchedule() {
    const selected = state.startAt;
    const originatingStep = state.step;
    const loaded = await loadSchedule();
    if (state.step !== originatingStep) return false;
    if (!loaded) {
      goTo(2);
      return false;
    }
    if (!selected || !validSlot()) {
      goTo(2);
      feedback("expired");
      return false;
    }
    return true;
  }
  function clearSchedule() {
    ++requestVersion;
    state.date = null;
    state.startAt = null;
    availabilityStatus = "idle";
    availability = indexAvailability(
      { source: state.availabilitySource, slots: [] },
      state.timezone,
      offerFor(state),
    );
  }

  // Eventos: el estado es la fuente de datos; el DOM solo lo presenta.
  $("#booking-types").addEventListener("change", (event) => {
    const type = event.target.value;
    if (!["prueba", "1a1", "dele"].includes(type)) return;
    state.type = type;
    if (type !== "1a1") state.plan = null;
    clearSchedule();
    if (type !== "dele") state.deleLevel = null;
    syncURL();
    feedback();
    render();
    $(`input[name="booking-type"][value="${type}"]`).focus();
  });
  $("#booking-plans").addEventListener("change", (event) => {
    const plan = Number(event.target.value);
    if (![1, 4, 8].includes(plan)) return;
    state.plan = plan;
    clearSchedule();
    syncURL();
    feedback();
    render();
    $(`input[name="booking-plan"][value="${plan}"]`).focus();
  });
  $("#booking-dele-level").addEventListener("change", (event) => {
    state.deleLevel = LEVELS.includes(event.target.value)
      ? event.target.value
      : null;
    clearSchedule();
    syncURL();
    feedback();
    renderSummary();
    $("#student-dele").textContent =
      `${t("deleLevel")}: ${state.deleLevel || t("pending")}`;
  });
  $("#service-next").addEventListener("click", async () => {
    if (!validService()) {
      feedback("chooseOfferError");
      return;
    }
    goTo(2);
    await loadSchedule();
  });
  for (const [id, delta] of [
    ["month-prev", -1],
    ["month-next", 1],
  ]) {
    $("#" + id).addEventListener("click", () => {
      const date = new Date(month + "-01T12:00:00Z");
      date.setUTCMonth(date.getUTCMonth() + delta);
      const next = date.toISOString().slice(0, 7);
      if (
        next < availability.today.slice(0, 7) ||
        next > availability.lastDay.slice(0, 7)
      )
        return;
      month = next;
      renderCalendar();
    });
  }
  $("#calendar-days").addEventListener("click", (event) => {
    const button = event.target.closest("[data-date]");
    if (!button || button.disabled) return;
    state.date = button.dataset.date;
    state.startAt = null;
    feedback();
    renderCalendar();
    renderSummary();
    $(`[data-date="${state.date}"]`).focus();
  });
  // Flechas opcionales entre fechas habilitadas; Tab/Enter funcionan de forma nativa.
  $("#calendar-days").addEventListener("keydown", (event) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[
      event.key
    ];
    const button = event.target.closest("[data-date]");
    if (!delta || !button) return;
    event.preventDefault();
    let next = addDays(button.dataset.date, delta);
    while (next >= availability.today && next <= availability.lastDay) {
      if (availability.slots.get(next)?.some((slot) => slot.available)) {
        month = next.slice(0, 7);
        renderCalendar();
        $(`[data-date="${next}"]`)?.focus();
        break;
      }
      next = addDays(next, Math.sign(delta));
    }
  });
  $("#booking-slots").addEventListener("click", (event) => {
    const button = event.target.closest("[data-slot]");
    if (!button || button.disabled) return;
    state.startAt = button.dataset.slot;
    feedback();
    renderSlots();
    renderSummary();
    $(`[data-slot="${state.startAt}"]`).focus();
  });
  $("#schedule-next").addEventListener("click", async () => {
    if (!validSlot()) {
      feedback("chooseTimeError");
      return;
    }
    if (await refreshSchedule()) goTo(3);
  });
  root.querySelectorAll("[data-back]").forEach((button) => {
    button.addEventListener("click", () => goTo(Number(button.dataset.back)));
  });
  $("#student-form").addEventListener("input", (event) => {
    const key = event.target.name;
    if (Object.hasOwn(state.student, key))
      state.student[key] = event.target.value;
    if (formSubmitted) validateStudent();
  });
  $("#student-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    formSubmitted = true;
    if (!validateStudent(true)) {
      feedback("formError");
      return;
    }
    if (await refreshSchedule()) goTo(4);
  });
  $("#booking-confirm").addEventListener("click", async () => {
    if (submitting) return;
    if (!validService()) {
      goTo(1);
      feedback("chooseOfferError");
      return;
    }
    if (!validateStudent()) {
      goTo(3);
      feedback("formError");
      return;
    }
    submitting = true;
    renderAvailabilityStatus();
    try {
      if (!(await refreshSchedule())) return;
      const draft = await prepareBooking(state, availability);
      // Solo un borrador local. No se envían datos ni se promete una plaza.
      if (draft.status !== "draft_local")
        throw new Error("Unexpected booking state");
      goTo(5);
    } catch {
      feedback("submissionError");
    } finally {
      submitting = false;
      renderAvailabilityStatus();
    }
  });
  $("#booking-edit").addEventListener("click", () => {
    goTo(1);
  });
  // Zona IANA editable: conservar el instante UTC, recalcular su fecha local.
  const detectedZone = state.timezone;
  const fallbackZones = [
    "UTC",
    "Europe/Warsaw",
    "Europe/Madrid",
    "Europe/London",
    "America/Santiago",
    "America/New_York",
    "America/Mexico_City",
    "America/Los_Angeles",
    "Asia/Tokyo",
    "Australia/Sydney",
  ];
  const zones = [
    ...new Set([
      detectedZone,
      "UTC",
      ...(Intl.supportedValuesOf
        ? Intl.supportedValuesOf("timeZone")
        : fallbackZones),
    ]),
  ].sort();
  $("#booking-zone").innerHTML = zones
    .map(
      (zone) =>
        '<option value="' +
        escape(zone) +
        '">' +
        escape(zone.replaceAll("_", " ")) +
        "</option>",
    )
    .join("");
  $("#booking-zone").value = detectedZone;
  $("#booking-zone-toggle").addEventListener("click", () => {
    toggleZone($("#booking-zone-editor").hidden);
  });
  $("#booking-zone-editor").addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      toggleZone(false);
    }
  });
  $("#booking-zone").addEventListener("change", async (event) => {
    if (!zones.includes(event.target.value)) return;
    state.timezone = event.target.value;
    if (state.startAt) state.date = dateInZone(state.startAt, state.timezone);
    render();
    await loadSchedule();
  });
  $("#booking-demo").addEventListener("click", async () => {
    state.availabilitySource =
      state.availabilitySource === "demo" ? "unconnected" : "demo";
    clearSchedule();
    await loadSchedule();
  });
  $("#availability-retry").addEventListener("click", loadSchedule);
  new MutationObserver(render).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  syncURL();
  render();
  $("#booking-app").hidden = false;
})();
