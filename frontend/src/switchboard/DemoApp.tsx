import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Leaf,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";

interface Values {
  full_name: string;
  email: string;
  session: string;
  experience: string;
  access_notes: string;
  newsletter: boolean;
  agreement: boolean;
}
const empty: Values = {
  full_name: "",
  email: "",
  session: "",
  experience: "",
  access_notes: "",
  newsletter: false,
  agreement: false,
};

export default function DemoApp({ onLaunch }: { onLaunch?: () => void }) {
  const [values, setValues] = useState<Values>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [help, setHelp] = useState(false);

  function update(name: keyof Values, value: string | boolean) {
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[name];
      return next;
    });
    setMessage("");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setErrors({});
    setMessage("");
    try {
      const response = await fetch("/api/practice/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json();
      if (!response.ok) {
        setErrors(body.detail?.fields || {});
        setMessage(
          body.detail?.message ||
            "The registration could not be sent. Check the fields and try again.",
        );
      } else {
        setReceipt(body.reference);
      }
    } catch {
      setMessage(
        "The registration server is unavailable. Start the Python API, then try again.",
      );
    } finally {
      setSending(false);
    }
  }
  const props = (name: keyof Values) => ({
    "aria-invalid": errors[name] ? (true as const) : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  const error = (name: keyof Values) =>
    errors[name] ? (
      <p className="cg-error" id={`${name}-error`}>
        {errors[name]}
      </p>
    ) : null;

  return (
    <div className="cg-root">
      <div className="cg-lab-bar">
        <div>
          <span className="cg-switch-symbol">
            <SlidersHorizontal size={16} />
          </span>
          <strong>Switchboard</strong>
          <span className="cg-lab-label">Live practice site</span>
        </div>
        <button
          onClick={() => setHelp((previous) => !previous)}
          aria-expanded={help}
        >
          About this demo <ChevronRight size={13} />
        </button>
      </div>
      {help && (
        <aside className="cg-about">
          <h2>A real form. A separate way to use it.</h2>
          <p>
            This fictional workshop site is a normal React form backed by a
            Python API. Switchboard reads and updates its native controls; there
            is no special autofill connection. Try the laser-cutting workshop to
            encounter an actual server-side availability error, then recover by
            choosing another session.
          </p>
          <p>
            The task view processes form data locally. Submitting sends the
            practice values to this site's server. Use fictional details. No
            real booking or email is created.
          </p>
          <a href="/fixtures/native.html">
            Try the independent plain HTML fixture <ExternalLink size={13} />
          </a>
          <a href="/switchboard-extension.zip" download>
            Download the Chrome extension <ExternalLink size={13} />
          </a>
        </aside>
      )}
      <header className="cg-header">
        <a className="cg-brand" href="/">
          <span className="cg-brand-icon">
            <Leaf size={23} />
          </span>
          common ground<span>Community workshop</span>
        </a>
        <nav aria-label="Workshop navigation">
          <a href="#workshop-details">The workshop</a>
          <a href="#registration">
            Reserve a place <ArrowRight size={15} />
          </a>
        </nav>
      </header>
      <main className="cg-main">
        <a className="cg-back" href="#workshop-details">
          <ArrowLeft size={14} />
          Weekend workshops
        </a>
        <section className="cg-intro" id="workshop-details">
          <div className="cg-intro-copy">
            <p className="cg-location">
              <MapPin size={14} />
              Riverside studio
            </p>
            <h1>
              Make something
              <br />
              with your Saturday.
            </h1>
            <p>
              A little curiosity. A few good tools. Join your neighbours for a
              hands-on morning at the studio.
            </p>
          </div>
          <div className="cg-event-note">
            <span className="cg-event-icon">
              <Wrench size={26} strokeWidth={1.5} />
            </span>
            <h2>
              Small groups.
              <br />
              Room to try.
            </h2>
            <p>
              Saturday, June 12, 2027
              <br />
              10:00–12:00 · Studio 2
            </p>
            <span>Fictional event for this demo</span>
          </div>
        </section>
        <div className="cg-content-grid">
          <section
            className="cg-registration"
            id="registration"
            aria-labelledby="registration-title"
          >
            <div className="cg-form-heading">
              <span className="cg-section-icon">
                <SlidersHorizontal size={18} />
              </span>
              <div>
                <h2 id="registration-title">Join a workshop</h2>
                <p>Choose your session. We'll bring the tools.</p>
              </div>
            </div>
            {receipt ? (
              <div className="cg-receipt" role="status">
                <CheckCircle2 size={40} />
                <h3>Practice registration received.</h3>
                <p>
                  Reference <strong>{receipt}</strong>
                </p>
                <p>
                  No real booking or email has been created. Your values were
                  validated by the practice server.
                </p>
                <button
                  className="cg-button cg-outline"
                  onClick={() => {
                    setReceipt("");
                    setValues(empty);
                    setErrors({});
                    setMessage("");
                  }}
                >
                  Start a new practice registration
                </button>
              </div>
            ) : (
              <form
                aria-labelledby="registration-title"
                onSubmit={submit}
                noValidate
              >
                <fieldset>
                  <legend>Your details</legend>
                  <div className="cg-field">
                    <label htmlFor="full_name">
                      Full name <span aria-hidden="true">Required</span>
                    </label>
                    <input
                      id="full_name"
                      name="full_name"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={100}
                      value={values.full_name}
                      onChange={(event) =>
                        update("full_name", event.target.value)
                      }
                      {...props("full_name")}
                    />
                    {error("full_name")}
                  </div>
                  <div className="cg-field">
                    <label htmlFor="email">
                      Email address <span aria-hidden="true">Required</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={200}
                      value={values.email}
                      onChange={(event) => update("email", event.target.value)}
                      {...props("email")}
                    />
                    {error("email")}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>Your workshop</legend>
                  <div className="cg-field">
                    <label htmlFor="session">
                      Workshop session <span aria-hidden="true">Required</span>
                    </label>
                    <select
                      id="session"
                      name="session"
                      required
                      value={values.session}
                      onChange={(event) =>
                        update("session", event.target.value)
                      }
                      {...props("session")}
                    >
                      <option value="">Choose a session</option>
                      <option value="repair">
                        Everyday repairs — places available
                      </option>
                      <option value="sewing">
                        Sewing basics — places available
                      </option>
                      <option value="laser">
                        Laser-cutting introduction — availability checked on
                        submit
                      </option>
                    </select>
                    {error("session")}
                  </div>
                  <fieldset className="cg-radio-group">
                    <legend>Have you joined us before?</legend>
                    <label>
                      <input
                        type="radio"
                        name="experience"
                        value="first-time"
                        required
                        checked={values.experience === "first-time"}
                        onChange={(event) =>
                          update("experience", event.target.value)
                        }
                        {...props("experience")}
                      />
                      This is my first visit
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="experience"
                        value="returning"
                        required
                        checked={values.experience === "returning"}
                        onChange={(event) =>
                          update("experience", event.target.value)
                        }
                        {...props("experience")}
                      />
                      I've been here before
                    </label>
                    {error("experience")}
                  </fieldset>
                </fieldset>
                <fieldset>
                  <legend>A little more</legend>
                  <div className="cg-field">
                    <label htmlFor="access_notes">
                      Anything you'd like us to know?{" "}
                      <span aria-hidden="true">Optional</span>
                    </label>
                    <textarea
                      id="access_notes"
                      name="access_notes"
                      rows={3}
                      maxLength={500}
                      value={values.access_notes}
                      onChange={(event) =>
                        update("access_notes", event.target.value)
                      }
                    />
                    <p className="cg-field-hint">
                      For the demo, avoid personal or sensitive information.
                    </p>
                  </div>
                  <label className="cg-check">
                    <input
                      type="checkbox"
                      name="newsletter"
                      checked={values.newsletter}
                      onChange={(event) =>
                        update("newsletter", event.target.checked)
                      }
                    />
                    <span>
                      Send me news about future workshops.{" "}
                      <small aria-hidden="true">Optional</small>
                    </span>
                  </label>
                  <label className="cg-check">
                    <input
                      type="checkbox"
                      name="agreement"
                      required
                      checked={values.agreement}
                      onChange={(event) =>
                        update("agreement", event.target.checked)
                      }
                      {...props("agreement")}
                    />
                    <span>
                      I understand this is a fictional practice booking.{" "}
                      <small aria-hidden="true">Required</small>
                    </span>
                  </label>
                  {error("agreement")}
                </fieldset>
                {message && (
                  <div className="cg-error-summary" role="alert">
                    {message}
                  </div>
                )}
                <div className="cg-submit">
                  <button
                    type="submit"
                    className="cg-button cg-primary"
                    disabled={sending}
                  >
                    {sending ? "Checking availability…" : "Reserve my place"}
                    <ArrowRight size={16} />
                  </button>
                  <p>
                    <ShieldCheck size={14} />
                    Practice only. No payment or real booking.
                  </p>
                </div>
              </form>
            )}
          </section>
          <aside className="cg-companion">
            <div className="cg-companion-mark">
              <SlidersHorizontal size={24} />
            </div>
            <h2>
              The same form.
              <br />
              Your way through.
            </h2>
            <p>
              Use Switchboard to navigate the form in sections, enter text, and
              review each choice before sending.
            </p>
            {onLaunch && (
              <button className="cg-button cg-launch" onClick={onLaunch}>
                Open Switchboard
                <ArrowRight size={17} />
              </button>
            )}
            <div className="cg-shortcut">
              <kbd>Space</kbd>
              <span>
                One switch selects.
                <br />
                Scanning does the moving.
              </span>
            </div>
            <ul>
              <li>
                <Check size={15} />
                Real changes to the form
              </li>
              <li>
                <Check size={15} />
                No AI or API key needed
              </li>
              <li>
                <Check size={15} />
                You authorize the final action
              </li>
            </ul>
            <a
              className="cg-install-link"
              href="/switchboard-extension.zip"
              download
            >
              Get the Chrome extension <ExternalLink size={13} />
            </a>
            <p className="cg-companion-note">
              The embedded panel is a page demo of the same code shipped in the
              extension. Supported native controls only.
            </p>
          </aside>
        </div>
        <footer className="cg-footer">
          <span>
            Common Ground is a fictional site built to test Switchboard.
          </span>
          <a href="/fixtures/native.html">
            Plain HTML test form <ExternalLink size={12} />
          </a>
          <a href="/notice">Earlier Notice → Action prototype</a>
        </footer>
      </main>
    </div>
  );
}
