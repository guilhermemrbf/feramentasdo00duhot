// JavaScript / signup-page.mjs / browser DOM / Instagram HTTPS signup only.
// Serialized into the browser by the local runtime; never accepts a script from HTTP input.
export function signupPage(input) {
  if (location.href === "about:blank") return { status: "waiting" };
  if (location.origin !== "https://www.instagram.com") return { status: "manual" };
  const text = document.body?.innerText || "";
  if (
    /challenge|checkpoint|captcha/.test(location.pathname) ||
    document.querySelector(
      'iframe[src*="captcha"], iframe[src*="challenge"], input[name="security_code"], input[name="confirmationCode"]',
    )
  )
    return { status: "verification" };
  if (
    /try again later|tente novamente mais tarde|temporarily blocked|suspended|suspensa/i.test(text)
  )
    return { status: "blocked" };
  if (!/^\/accounts\/emailsignup\/?$/.test(location.pathname)) return { status: "manual" };
  const visible = (element) =>
    element && element.getClientRects().length && !element.disabled && !element.readOnly;
  const fields = [
    ['input[name="emailOrPhone"]', input.contact],
    ['input[name="fullName"]', input.fullName],
    ['input[name="username"]', input.username],
    ['input[name="password"]', input.password],
  ];
  if (!fields.every(([selector]) => visible(document.querySelector(selector))))
    return { status: "waiting" };
  const elements = fields.map(([selector]) => document.querySelector(selector));
  const form = elements[0].form;
  if (!form || elements.some((element) => element.form !== form)) return { status: "manual" };
  if (form.dataset.mouseHotSubmitted === "true") return { status: "submitted" };
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  fields.forEach(([selector, value]) => {
    const element = document.querySelector(selector);
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  // Frameworks can update the submit button on the next render. A subsequent call rechecks it.
  const button = form.querySelector('button[type="submit"]');
  if (!visible(button)) return { status: "waiting" };
  if (!/^(sign up|cadastre-se|cadastrar|registrar-se)$/i.test(button.textContent.trim()))
    return { status: "manual" };
  form.dataset.mouseHotSubmitted = "true";
  button.click();
  return { status: "submitted" };
}
