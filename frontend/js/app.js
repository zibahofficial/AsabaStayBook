const state = {
  token: localStorage.getItem('asaba_token'),
  user: null,
  properties: [],
  bookings: [],
  view: 'dashboard'
};

const $ = (selector) => document.querySelector(selector);

/* =========================
   API
========================= */

const api = async (path, options = {}) => {
  options.headers = {
    ...(options.headers || {}),
    ...(state.token
      ? { Authorization: `Bearer ${state.token}` }
      : {})
  };

  if (options.body && !options.headers['Content-Type']) {
    options.headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(
    `http://127.0.0.1:8000/api${path}`,
    options
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    let message = 'Request failed';

    if (typeof data.detail === 'string') {
      message = data.detail;
    } else if (Array.isArray(data.detail)) {
      message = data.detail
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }

          if (item?.msg) {
            return item.msg;
          }

          return JSON.stringify(item);
        })
        .join('; ');
    } else if (
      data.detail &&
      typeof data.detail === 'object'
    ) {
      message =
        data.detail.message ||
        data.detail.error ||
        data.detail.msg ||
        JSON.stringify(data.detail);
    } else if (data.message) {
      message = data.message;
    }

    throw new Error(message);
  }

  return data;
};

/* =========================
   HELPERS
========================= */

function money(value) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function esc(value) {
  return String(value ?? '').replace(
    /[&<>'"]/g,
    (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[character])
  );
}

/*
  Creates a safe phone value for tel: links.
  Keeps numbers and the leading + sign.
*/
function phoneForLink(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^\d+]/g, '');
}

function formatDate(value) {
  if (!value) return '—';

  return new Date(value).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatDateTime(value) {
  if (!value) return '—';

  return new Date(value).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function statusBadge(status) {
  const safeStatus = status || 'confirmed';

  const label =
    safeStatus.charAt(0).toUpperCase() +
    safeStatus.slice(1);

  return `
    <span class="status ${esc(safeStatus)}">
      ${esc(label)}
    </span>
  `;
}

function calendarDay(value) {
  return new Date(value)
    .getDate()
    .toString()
    .padStart(2, '0');
}

function calendarMonth(value) {
  return new Date(value)
    .toLocaleDateString('en-NG', {
      month: 'short'
    })
    .toUpperCase();
}

/* =========================
   LOAD DATA
========================= */

async function load() {
  state.user = await api('/auth/me');

  state.properties = await api('/properties');

  state.bookings = await api('/bookings');

  updateUserDisplay();

  setupRoleNavigation();

  render();
}

/* =========================
   USER DISPLAY
========================= */

function updateUserDisplay() {
  const roleElement = $('#currentUserRole');

  if (!roleElement || !state.user) {
    return;
  }

  if (state.user.role === 'owner') {
    roleElement.textContent =
      'Property Owner / Manager';
  } else if (state.user.role === 'admin') {
    roleElement.textContent =
      'Administrator';
  } else {
    roleElement.textContent =
      'Customer';
  }
}

/* =========================
   SHOW APP
========================= */

function showApp() {
  const loginView = $('#loginView');
  const app = $('#app');

  if (loginView) {
    loginView.classList.add('hidden');
  }

  if (app) {
    app.classList.remove('hidden');
  }

  load().catch((error) => {
    console.error(error);

    if (error.message) {
      alert(error.message);
    }

    if (
      error.message?.toLowerCase().includes('401') ||
      error.message?.toLowerCase().includes('unauthorized')
    ) {
      localStorage.removeItem('asaba_token');
      state.token = null;
      location.reload();
    }
  });
}

/* =========================
   LOGIN
========================= */

function setupLoginForm() {
  const loginForm = $('#loginForm');

  if (!loginForm) {
    return;
  }

  loginForm.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      const loginError = $('#loginError');

      if (loginError) {
        loginError.textContent = '';
      }

      try {
        const result = await api('/auth/login', {
          method: 'POST',

          body: JSON.stringify({
            email: $('#email').value.trim(),
            password: $('#password').value
          })
        });

        state.token = result.access_token;

        localStorage.setItem(
          'asaba_token',
          state.token
        );

        showApp();

      } catch (error) {
        if (loginError) {
          loginError.textContent =
            error.message;
        }
      }
    }
  );
}

/* =========================
   SHOW REGISTER
========================= */

function setupAuthSwitching() {
  const showRegister = $('#showRegister');
  const showLogin = $('#showLogin');

  if (showRegister) {
    showRegister.addEventListener(
      'click',
      () => {
        $('#signInPanel')
          ?.classList
          .add('hidden');

        $('#registerPanel')
          ?.classList
          .remove('hidden');

        const loginError = $('#loginError');

        if (loginError) {
          loginError.textContent = '';
        }
      }
    );
  }

  if (showLogin) {
    showLogin.addEventListener(
      'click',
      () => {
        $('#registerPanel')
          ?.classList
          .add('hidden');

        $('#signInPanel')
          ?.classList
          .remove('hidden');

        const registerError =
          $('#registerError');

        if (registerError) {
          registerError.textContent = '';
        }
      }
    );
  }
}

/* =========================
   REGISTER
========================= */

function setupRegisterForm() {
  const registerForm =
    $('#registerForm');

  if (!registerForm) {
    return;
  }

  registerForm.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      const registerError =
        $('#registerError');

      if (registerError) {
        registerError.textContent = '';
      }

      const email =
        $('#registerEmail')
          .value
          .trim();

      const password =
        $('#registerPassword')
          .value;

      const confirmPassword =
        $('#registerConfirmPassword')
          .value;

      const role =
        $('#registerRole')
          .value;

      if (!email) {
        if (registerError) {
          registerError.textContent =
            'Please enter your email address.';
        }

        return;
      }

      if (password.length < 8) {
        if (registerError) {
          registerError.textContent =
            'Password must be at least 8 characters.';
        }

        return;
      }

      if (password !== confirmPassword) {
        if (registerError) {
          registerError.textContent =
            'Passwords do not match.';
        }

        return;
      }

      if (!role) {
        if (registerError) {
          registerError.textContent =
            'Please select an account type.';
        }

        return;
      }

      try {
        const result = await api(
          '/auth/register',
          {
            method: 'POST',

            body: JSON.stringify({
              email,
              password,
              confirm_password:
                confirmPassword,
              role
            })
          }
        );

        state.token =
          result.access_token;

        localStorage.setItem(
          'asaba_token',
          state.token
        );

        showApp();

      } catch (error) {
        if (registerError) {
          registerError.textContent =
            error.message;
        }
      }
    }
  );
}

/* =========================
   LOGOUT
========================= */

function setupLogout() {
  const logout = $('#logout');

  if (!logout) {
    return;
  }

  logout.onclick = () => {
    localStorage.removeItem(
      'asaba_token'
    );

    state.token = null;
    state.user = null;

    location.reload();
  };
}

/* =========================
   ROLE-BASED NAVIGATION
========================= */

function setupRoleNavigation() {
  const navigationButtons =
    document.querySelectorAll(
      '.nav[data-view]'
    );

  navigationButtons.forEach((button) => {
    const view =
      button.dataset.view;

    button.style.display = 'flex';

    if (
      state.user &&
      state.user.role === 'customer'
    ) {
      if (view === 'properties') {
        button.textContent =
          'Browse Properties';
      }

      if (view === 'bookings') {
        button.textContent =
          'My Bookings';
      }
    }

    if (
      state.user &&
      state.user.role === 'owner'
    ) {
      if (view === 'properties') {
        button.textContent =
          'My Properties';
      }

      if (view === 'bookings') {
        button.textContent =
          'Bookings';
      }
    }

    if (
      state.user &&
      state.user.role === 'admin'
    ) {
      if (view === 'properties') {
        button.textContent =
          'Properties';
      }

      if (view === 'bookings') {
        button.textContent =
          'All Bookings';
      }
    }

    button.onclick = () => {
      state.view = view;

      document
        .querySelectorAll(
          '.nav[data-view]'
        )
        .forEach((item) => {
          item.classList.toggle(
            'active',
            item === button
          );
        });

      render();
    };
  });
}

/* =========================
   NEW BOOKING BUTTON
========================= */

function setupNewBookingButton() {
  const newBooking =
    $('#newBooking');

  if (!newBooking) {
    return;
  }

  /*
    Only customers should create bookings
    through the customer-facing booking flow.
  */
  if (
    state.user &&
    state.user.role !== 'customer'
  ) {
    newBooking.style.display = 'none';
    return;
  }

  newBooking.onclick = () => {
    openModal();
  };
}

/* =========================
   MAIN RENDER
========================= */

function render() {
  const pageTitle =
    $('#pageTitle');

  const content =
    $('#content');

  if (!content) {
    return;
  }

  const titles = {
    dashboard: 'Overview',

    calendar:
      'Booking Calendar',

    bookings:
      state.user?.role === 'customer'
        ? 'My Bookings'
        : 'Bookings',

    properties:
      state.user?.role === 'owner'
        ? 'My Properties'
        : state.user?.role === 'customer'
          ? 'Browse Properties'
          : 'Properties'
  };

  if (pageTitle) {
    pageTitle.textContent =
      titles[state.view] ||
      'Overview';
  }

  if (
    state.view === 'dashboard'
  ) {
    dashboard(content);
  }

  if (
    state.view === 'bookings'
  ) {
    bookings(content);
  }

  if (
    state.view === 'calendar'
  ) {
    calendar(content);
  }

  if (
    state.view === 'properties'
  ) {
    properties(content);
  }
}

/* =========================
   DASHBOARD
========================= */

function dashboard(content) {
  const role =
    state.user?.role;

  const activeBookings =
    state.bookings.filter(
      (booking) =>
        booking.status ===
          'confirmed' ||
        booking.status ===
          'pending'
    );

  const totalRevenue =
    activeBookings.reduce(
      (sum, booking) =>
        sum +
        Number(
          booking.total_amount || 0
        ),
      0
    );

  const totalDeposits =
    activeBookings.reduce(
      (sum, booking) =>
        sum +
        Number(
          booking.deposit_amount || 0
        ),
      0
    );

  let welcomeText =
    'Your hospitality bookings at a glance.';

  if (role === 'customer') {
    welcomeText =
      'Find properties and manage your bookings.';
  }

  if (role === 'owner') {
    welcomeText =
      'Manage your properties, bookings and deposits.';
  }

  if (role === 'admin') {
    welcomeText =
      'Manage the AsabaStayBook platform.';
  }

  content.innerHTML = `
    <div class="stats-grid">

      <div class="stat-card">
        <span>Properties</span>
        <strong>
          ${state.properties.length}
        </strong>
      </div>

      <div class="stat-card">
        <span>Active bookings</span>
        <strong>
          ${activeBookings.length}
        </strong>
      </div>

      <div class="stat-card">
        <span>Revenue</span>
        <strong>
          ${money(totalRevenue)}
        </strong>
      </div>

      <div class="stat-card">
        <span>Outstanding</span>
        <strong>
          ${money(
            totalRevenue -
            totalDeposits
          )}
        </strong>
      </div>

    </div>

    <div class="panel">

      <div class="panel-head">

        <div>

          <h2>
            ${
              role === 'customer'
                ? 'Welcome to AsabaStayBook'
                : role === 'owner'
                  ? 'Property management'
                  : 'Recent bookings'
            }
          </h2>

          <p class="muted">
            ${welcomeText}
          </p>

        </div>

      </div>

      ${
        role === 'owner'
          ? `
            <div class="panel">

              <h3>
                Property Owner / Manager
              </h3>

              <p class="muted">
                Your properties will appear under
                <strong>My Properties</strong>.
                From there you can manage the spaces
                available for booking.
              </p>

              <button
                class="btn primary"
                onclick="openPropertyModal()"
              >
                + Add Property
              </button>

            </div>
          `
          : ''
      }

      ${
        role === 'customer'
          ? `
            <div class="panel">

              <h3>
                Find a place in Asaba
              </h3>

              <p class="muted">
                Browse hotels, shortlets and event
                centres available on AsabaStayBook.
              </p>

              <button
                class="btn primary"
                onclick="goToView('properties')"
              >
                Browse Properties
              </button>

            </div>
          `
          : ''
      }

      ${
        state.bookings.length
          ? `
            <h3>
              Recent bookings
            </h3>

            ${state.bookings
              .slice()
              .sort(
                (a, b) =>
                  new Date(
                    b.start_at
                  ) -
                  new Date(
                    a.start_at
                  )
              )
              .slice(0, 5)
              .map(
                (booking) => `
                  <div class="booking-row">

                    <div>

                      <strong>
                        ${esc(
                          booking.customer_name
                        )}
                      </strong>

                      <div class="muted">
                        ${formatDateTime(
                          booking.start_at
                        )}
                      </div>

                    </div>

                    <div>
                      ${money(
                        booking.total_amount
                      )}
                    </div>

                    <div>
                      ${statusBadge(
                        booking.status
                      )}
                    </div>

                  </div>
                `
              )
              .join('')}

          `
          : `
            ${
              role === 'customer'
                ? ''
                : `
                  <p class="muted">
                    No bookings yet.
                  </p>
                `
            }
          `
      }

    </div>
  `;
}

/* =========================
   GO TO VIEW
========================= */

function goToView(view) {
  state.view = view;

  document
    .querySelectorAll(
      '.nav[data-view]'
    )
    .forEach((button) => {
      button.classList.toggle(
        'active',
        button.dataset.view === view
      );
    });

  render();
}

/* =========================
   BOOKINGS
========================= */

function bookings(content) {
  const role =
    state.user?.role;

  content.innerHTML = `
    <div class="panel">

      <div class="panel-head">

        <div>

          <h2>
            ${
              role === 'customer'
                ? 'My Bookings'
                : 'Bookings'
            }
          </h2>

          <p class="muted">
            ${
              role === 'customer'
                ? 'View your hospitality reservations.'
                : 'Manage booking records and deposits.'
            }
          </p>

        </div>

        ${
          role === 'customer'
            ? `
              <button
                class="btn primary"
                onclick="openModal()"
              >
                + New Booking
              </button>
            `
            : ''
        }

      </div>

      ${
        state.bookings.length
          ? `
            <div class="table-wrap">

              <table>

                <thead>

                  <tr>
                    <th>Customer</th>
                    <th>Property</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Deposit</th>
                    <th>Status</th>

                    ${
                      role === 'customer'
                        ? '<th>Contact / Action</th>'
                        : ''
                    }

                  </tr>

                </thead>

                <tbody>

                  ${state.bookings
                    .map((booking) => {

                      const property =
                        state.properties.find(
                          (property) =>
                            property.id ===
                            booking.property_id
                        );

                      const contactPhone =
                        property?.contact_phone || '';

                      const safePhone =
                        phoneForLink(
                          contactPhone
                        );

                      return `
                        <tr>

                          <td>
                            ${esc(
                              booking.customer_name
                            )}
                          </td>

                          <td>
                            ${
                              property
                                ? esc(
                                    property.name
                                  )
                                : 'Unknown'
                            }
                          </td>

                          <td>
                            ${formatDate(
                              booking.start_at
                            )}
                          </td>

                          <td>
                            ${money(
                              booking.total_amount
                            )}
                          </td>

                          <td>
                            ${money(
                              booking.deposit_amount
                            )}
                          </td>

                          <td>
                            ${statusBadge(
                              booking.status
                            )}
                          </td>

                          ${
                            role === 'customer'
                              ? `
                                <td>

                                  ${
                                    contactPhone
                                      ? `
                                        <div
                                          style="
                                            display:flex;
                                            flex-direction:column;
                                            gap:6px;
                                          "
                                        >

                                          <small class="muted">
                                            Payment / Contact
                                          </small>

                                          <a
                                            href="tel:${esc(
                                              safePhone
                                            )}"
                                          >
                                            ${esc(
                                              contactPhone
                                            )}
                                          </a>

                                          <a
                                            class="btn primary"
                                            href="tel:${esc(
                                              safePhone
                                            )}"
                                          >
                                            Contact Owner
                                          </a>

                                          ${
                                            booking.status !== 'cancelled' &&
                                            booking.status !== 'expired'
                                              ? `
                                                <button
                                                  class="btn danger"
                                                  onclick="cancelBooking(${booking.id})"
                                                >
                                                  Cancel Booking
                                                </button>
                                              `
                                              : ''
                                          }

                                        </div>
                                      `
                                      : `
                                        <div>

                                          <span class="muted">
                                            Contact information not provided yet.
                                          </span>

                                          ${
                                            booking.status !== 'cancelled' &&
                                            booking.status !== 'expired'
                                              ? `
                                                <br><br>

                                                <button
                                                  class="btn danger"
                                                  onclick="cancelBooking(${booking.id})"
                                                >
                                                  Cancel Booking
                                                </button>
                                              `
                                              : ''
                                          }

                                        </div>
                                      `
                                  }

                                </td>
                              `
                              : ''
                          }

                        </tr>
                      `;
                    })
                    .join('')}

                </tbody>

              </table>

            </div>
          `
          : `
            <p class="muted">
              ${
                role === 'customer'
                  ? 'You do not have any bookings yet.'
                  : 'No bookings found.'
              }
            </p>
          `
      }

    </div>
  `;
}

/* =========================
   CALENDAR
========================= */

function calendar(content) {
  const sorted =
    state.bookings
      .slice()
      .sort(
        (a, b) =>
          new Date(a.start_at) -
          new Date(b.start_at)
      );

  content.innerHTML = `
    <div class="panel">

      <div class="panel-head">

        <div>

          <h2>
            Booking Calendar
          </h2>

          <p class="muted">
            View scheduled bookings and prevent
            overlapping reservations.
          </p>

        </div>

      </div>

      ${
        sorted.length
          ? `
            <div class="calendar-list">

              ${sorted
                .map((booking) => {

                  const property =
                    state.properties.find(
                      (item) =>
                        item.id ===
                        booking.property_id
                    );

                  return `
                    <div class="calendar-item">

                      <div class="calendar-date">

                        <strong>
                          ${calendarDay(
                            booking.start_at
                          )}
                        </strong>

                        <span>
                          ${calendarMonth(
                            booking.start_at
                          )}
                        </span>

                      </div>

                      <div class="calendar-info">

                        <strong>
                          ${
                            property
                              ? esc(
                                  property.name
                                )
                              : 'Unknown property'
                          }
                        </strong>

                        <p>
                          ${esc(
                            booking.customer_name
                          )}
                        </p>

                        <small>
                          ${formatDateTime(
                            booking.start_at
                          )}

                          →

                          ${formatDateTime(
                            booking.end_at
                          )}
                        </small>

                      </div>

                      <div>
                        ${statusBadge(
                          booking.status
                        )}
                      </div>

                    </div>
                  `;
                })
                .join('')}

            </div>
          `
          : `
            <p class="muted">
              No bookings scheduled.
            </p>
          `
      }

    </div>
  `;
}

/* =========================
   PROPERTIES
========================= */

function properties(content) {
  const role =
    state.user?.role;

  content.innerHTML = `
    <div class="panel">

      <div class="panel-head">

        <div>

          <h2>
            ${
              role === 'owner'
                ? 'My Properties'
                : role === 'customer'
                  ? 'Browse Properties'
                  : 'Properties'
            }
          </h2>

          <p class="muted">
            Hotels, shortlets and event centres
            connected to AsabaStayBook.
          </p>

        </div>

        ${
          role === 'owner' ||
          role === 'admin'
            ? `
              <button
                class="btn primary"
                onclick="openPropertyModal()"
              >
                + Add Property
              </button>
            `
            : ''
        }

      </div>

      ${
        state.properties.length
          ? `
            <div class="property-grid">

              ${state.properties
                .map(
                  (property) => {

                    const contactPhone =
                      property.contact_phone ||
                      '';

                    const safePhone =
                      phoneForLink(
                        contactPhone
                      );

                    return `
                      <article class="property-card">

                        ${
                          property.image
                            ? `
                              <img
                                src="${esc(
                                  property.image
                                )}"
                                alt="${esc(
                                  property.name
                                )}"
                              >
                            `
                            : ''
                        }

                        <div class="property-body">

                          <h3>
                            ${esc(
                              property.name
                            )}
                          </h3>

                          <p class="muted">

                            ${esc(
                              property.kind
                            )}

                            ·

                            ${esc(
                              property.location
                            )}

                          </p>

                          <p>
                            Capacity:
                            ${property.capacity}
                          </p>

                          <strong>
                            ${money(
                              property.price_per_day
                            )}
                            / day
                          </strong>

                          ${
                            role === 'customer'
                              ? `
                                <div
                                  class="payment-contact"
                                  style="
                                    margin-top:16px;
                                    padding:14px;
                                    border-radius:12px;
                                    background:#f3e8ff;
                                  "
                                >

                                  <strong>
                                    Payment & Contact
                                  </strong>

                                  <p
                                    class="muted"
                                    style="margin:6px 0;"
                                  >
                                    Contact this number for
                                    payment instructions or
                                    more information.
                                  </p>

                                  ${
                                    contactPhone
                                      ? `
                                        <a
                                          href="tel:${esc(
                                            safePhone
                                          )}"
                                          style="
                                            font-weight:700;
                                            display:block;
                                            margin-bottom:10px;
                                          "
                                        >
                                          ${esc(
                                            contactPhone
                                          )}
                                        </a>

                                        <a
                                          class="btn primary"
                                          href="tel:${esc(
                                            safePhone
                                          )}"
                                        >
                                          Contact Owner
                                        </a>
                                      `
                                      : `
                                        <p class="muted">
                                          Contact information
                                          not provided yet.
                                        </p>
                                      `
                                  }

                                </div>

                                <br>

                                <button
                                  class="btn primary"
                                  onclick="openModalForProperty(${property.id})"
                                >
                                  Book this property
                                </button>
                              `
                              : ''
                          }

                          ${
                            role === 'owner' ||
                            role === 'admin'
                              ? `
                                <div
                                  style="
                                    margin-top:14px;
                                    display:flex;
                                    gap:8px;
                                    flex-wrap:wrap;
                                  "
                                >

                                  ${
                                    contactPhone
                                      ? `
                                        <div
                                          class="muted"
                                          style="
                                            width:100%;
                                          "
                                        >
                                          Payment / Contact:
                                          <strong>
                                            ${esc(
                                              contactPhone
                                            )}
                                          </strong>
                                        </div>
                                      `
                                      : `
                                        <div
                                          class="muted"
                                          style="
                                            width:100%;
                                          "
                                        >
                                          No contact phone
                                          added yet.
                                        </div>
                                      `
                                  }

                                  <button
                                    class="btn danger"
                                    onclick="deleteProperty(${property.id})"
                                  >
                                    Delete
                                  </button>

                                </div>
                              `
                              : ''
                          }

                        </div>

                      </article>
                    `;
                  }
                )
                .join('')}

            </div>
          `
          : `
            <div>

              <p class="muted">

                ${
                  role === 'owner'
                    ? 'You have not added any properties yet.'
                    : 'No properties have been added yet.'
                }

              </p>

              ${
                role === 'owner'
                  ? `
                    <button
                      class="btn primary"
                      onclick="openPropertyModal()"
                    >
                      + Add Your First Property
                    </button>
                  `
                  : ''
              }

            </div>
          `
      }

    </div>
  `;
}

/* =========================
   DELETE PROPERTY
========================= */

async function deleteProperty(propertyId) {
  const property =
    state.properties.find(
      (item) =>
        item.id === propertyId
    );

  const propertyName =
    property?.name ||
    'this property';

  const confirmed =
    confirm(
      `Are you sure you want to delete "${propertyName}"?\n\nThis action cannot be undone.`
    );

  if (!confirmed) {
    return;
  }

  try {
    await api(
      `/properties/${propertyId}`,
      {
        method: 'DELETE'
      }
    );

    alert(
      'Property deleted successfully.'
    );

    await load();

    state.view =
      'properties';

    render();

  } catch (error) {
    alert(
      `Could not delete property: ${error.message}`
    );
  }
}

/* =========================
   CANCEL BOOKING
========================= */

async function cancelBooking(bookingId) {
  const confirmed =
    confirm(
      'Are you sure you want to cancel this booking?'
    );

  if (!confirmed) {
    return;
  }

  try {
    /*
      IMPORTANT:
      The FastAPI backend expects the status
      as a query parameter.

      Correct:
      PATCH /api/bookings/{booking_id}/status?status=cancelled

      Do NOT send status in a JSON body.
    */

    await api(
      `/bookings/${bookingId}/status?status=cancelled`,
      {
        method: 'PATCH'
      }
    );

    alert(
      'Booking cancelled successfully.'
    );

    await load();

    state.view =
      'bookings';

    render();

  } catch (error) {
    console.error(
      'Cancel booking error:',
      error
    );

    alert(
      `Could not cancel booking: ${error.message}`
    );
  }
}

/* =========================
   PROPERTY MODAL
========================= */

function openPropertyModal() {
  const modal = $('#modal');

  if (!modal) {
    return;
  }

  modal
    .classList
    .remove('hidden');

  modal.innerHTML = `
    <div class="modal-card">

      <button
        type="button"
        class="modal-close"
        id="closePropertyModal"
      >
        ×
      </button>

      <h2>
        Add Property
      </h2>

      <p class="muted">
        Add a hotel, shortlet or event centre.
      </p>

      <form id="propertyForm">

        <label>
          Property name

          <input
            id="propertyName"
            type="text"
            placeholder="Example: Asaba Grand Hotel"
            required
          >
        </label>

        <label>
          Property type

          <select
            id="propertyKind"
            required
          >

            <option value="">
              Select property type
            </option>

            <option value="hotel">
              Hotel
            </option>

            <option value="shortlet">
              Shortlet
            </option>

            <option value="event-centre">
              Event Centre
            </option>

          </select>
        </label>

        <label>
          Location

          <input
            id="propertyLocation"
            type="text"
            placeholder="Asaba, Delta State"
            required
          >
        </label>

        <label>
          Capacity

          <input
            id="propertyCapacity"
            type="number"
            min="1"
            value="1"
            required
          >
        </label>

        <label>
          Price per day

          <input
            id="propertyPrice"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            required
          >
        </label>

        <!-- NEW CONTACT PHONE FIELD -->

        <label>
          Contact / Payment Phone Number

          <input
            id="propertyContactPhone"
            type="tel"
            placeholder="08012345678"
            required
          >
        </label>

        <small class="muted">
          Customers should contact this number
          for payment instructions or more information.
        </small>

        <label>
          Property Image

          <input
            id="propertyImage"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          >
        </label>

        <div
          id="propertyImagePreview"
          class="property-image-preview"
        ></div>

        <p class="muted">
          Choose a JPG, PNG or WebP image.
          Maximum size: 2 MB.
        </p>

        <p
          id="propertyError"
          class="error"
        ></p>

        <div class="modal-actions">

          <button
            type="button"
            class="btn"
            id="cancelProperty"
          >
            Cancel
          </button>

          <button
            type="submit"
            class="btn primary"
          >
            Add Property
          </button>

        </div>

      </form>

    </div>
  `;

  $('#closePropertyModal').onclick =
    closeModal;

  $('#cancelProperty').onclick =
    closeModal;

  $('#propertyImage').addEventListener(
    'change',
    previewPropertyImage
  );

  $('#propertyForm').addEventListener(
    'submit',
    createProperty
  );
}

/* =========================
   PROPERTY IMAGE PREVIEW
========================= */

function previewPropertyImage(event) {
  const file =
    event.target.files[0];

  const preview =
    $('#propertyImagePreview');

  const error =
    $('#propertyError');

  if (!preview || !error) {
    return;
  }

  preview.innerHTML = '';

  error.textContent = '';

  if (!file) {
    return;
  }

  if (
    file.size >
    2 * 1024 * 1024
  ) {
    error.textContent =
      'Image is too large. Please choose an image smaller than 2 MB.';

    event.target.value = '';

    return;
  }

  if (
    !file.type.startsWith(
      'image/'
    )
  ) {
    error.textContent =
      'Please choose a valid image file.';

    event.target.value = '';

    return;
  }

  const reader =
    new FileReader();

  reader.onload = () => {

    preview.innerHTML = `
      <img
        src="${reader.result}"
        alt="Property image preview"
        style="
          width:100%;
          max-width:320px;
          height:200px;
          object-fit:cover;
          border-radius:12px;
          display:block;
          margin-top:8px;
        "
      >
    `;

  };

  reader.readAsDataURL(file);
}

/* =========================
   CREATE PROPERTY
========================= */

async function createProperty(event) {
  event.preventDefault();

  const propertyError =
    $('#propertyError');

  if (propertyError) {
    propertyError.textContent = '';
  }

  const name =
    $('#propertyName')
      .value
      .trim();

  const kind =
    $('#propertyKind')
      .value;

  const location =
    $('#propertyLocation')
      .value
      .trim();

  const capacity =
    Number(
      $('#propertyCapacity')
        .value
    );

  const pricePerDay =
    Number(
      $('#propertyPrice')
        .value
    );

  /*
    NEW:
    Owner's customer-facing contact/payment number.
  */
  const contactPhone =
    $('#propertyContactPhone')
      .value
      .trim();

  const imageFile =
    $('#propertyImage')
      .files[0];

  if (
    !name ||
    !kind ||
    !location
  ) {
    if (propertyError) {
      propertyError.textContent =
        'Please complete all required fields.';
    }

    return;
  }

  if (!contactPhone) {
    if (propertyError) {
      propertyError.textContent =
        'Please enter the contact / payment phone number.';
    }

    return;
  }

  if (
    contactPhone.replace(
      /[^\d]/g,
      ''
    ).length < 7
  ) {
    if (propertyError) {
      propertyError.textContent =
        'Please enter a valid contact phone number.';
    }

    return;
  }

  if (
    !Number.isFinite(capacity) ||
    capacity < 1
  ) {
    if (propertyError) {
      propertyError.textContent =
        'Capacity must be at least 1.';
    }

    return;
  }

  if (
    !Number.isFinite(pricePerDay) ||
    pricePerDay < 0
  ) {
    if (propertyError) {
      propertyError.textContent =
        'Please enter a valid price.';
    }

    return;
  }

  if (
    imageFile &&
    imageFile.size >
      2 * 1024 * 1024
  ) {
    if (propertyError) {
      propertyError.textContent =
        'Image is too large. Please choose an image smaller than 2 MB.';
    }

    return;
  }

  try {

    let image = null;

    if (imageFile) {

      image =
        await new Promise(
          (resolve, reject) => {

            const reader =
              new FileReader();

            reader.onload = () => {
              resolve(
                reader.result
              );
            };

            reader.onerror = () => {
              reject(
                new Error(
                  'Could not read the selected image.'
                )
              );
            };

            reader.readAsDataURL(
              imageFile
            );

          }
        );

    }

    await api(
      '/properties',
      {
        method: 'POST',

        body: JSON.stringify({
          name,
          kind,
          location,
          capacity,
          price_per_day:
            pricePerDay,

          /*
            NEW:
            Send the contact phone
            to the FastAPI backend.
          */
          contact_phone:
            contactPhone,

          image
        })
      }
    );

    closeModal();

    await load();

    state.view =
      'properties';

    render();

    alert(
      'Property added successfully.'
    );

  } catch (error) {

    if (propertyError) {
      propertyError.textContent =
        error.message;
    }

  }
}

/* =========================
   NEW BOOKING MODAL
========================= */

function openModalForProperty(
  propertyId
) {
  openModal(propertyId);
}

function openModal(
  selectedPropertyId = null
) {
  const modal = $('#modal');

  if (!modal) {
    return;
  }

  const propertyOptions =
    state.properties.length
      ? state.properties
          .map(
            (property) => `
              <option
                value="${property.id}"
                ${
                  Number(
                    property.id
                  ) ===
                  Number(
                    selectedPropertyId
                  )
                    ? 'selected'
                    : ''
                }
              >
                ${esc(
                  property.name
                )}
              </option>
            `
          )
          .join('')
      : `
          <option value="">
            No properties available
          </option>
        `;

  modal
    .classList
    .remove('hidden');

  modal.innerHTML = `
    <div class="modal-card">

      <button
        type="button"
        class="modal-close"
        id="closeBookingModal"
      >
        ×
      </button>

      <h2>
        New Booking
      </h2>

      <p class="muted">
        Record a hotel, shortlet or event-centre booking.
      </p>

      <form id="bookingForm">

        <label>
          Property

          <select
            id="bookingProperty"
            required
          >

            <option value="">
              Select property
            </option>

            ${propertyOptions}

          </select>
        </label>

        <div
          id="bookingPropertyContact"
          style="
            display:none;
            margin-bottom:14px;
            padding:12px;
            border-radius:10px;
            background:#f3e8ff;
          "
        ></div>

        <label>
          Customer name

          <input
            id="bookingCustomerName"
            type="text"
            required
            placeholder="Customer name"
          >
        </label>

        <label>
          Customer phone

          <input
            id="bookingCustomerPhone"
            type="tel"
            required
            placeholder="08012345678"
          >
        </label>

        <label>
          Start date and time

          <input
            id="bookingStart"
            type="datetime-local"
            required
          >
        </label>

        <label>
          End date and time

          <input
            id="bookingEnd"
            type="datetime-local"
            required
          >
        </label>

        <label>
          Total amount

          <input
            id="bookingTotal"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="0"
          >
        </label>

        <label>
          Deposit amount

          <input
            id="bookingDeposit"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="0"
          >
        </label>

        <label>
          Notes

          <textarea
            id="bookingNotes"
            rows="3"
            placeholder="Optional notes"
          ></textarea>
        </label>

        <p
          id="bookingError"
          class="error"
        ></p>

        <div class="modal-actions">

          <button
            type="button"
            class="btn"
            id="cancelBooking"
          >
            Cancel
          </button>

          <button
            type="submit"
            class="btn primary"
          >
            Create Booking
          </button>

        </div>

      </form>

    </div>
  `;

  $('#closeBookingModal').onclick =
    closeModal;

  $('#cancelBooking').onclick =
    closeModal;

  $('#bookingProperty').addEventListener(
    'change',
    updateBookingPropertyContact
  );

  $('#bookingForm').addEventListener(
    'submit',
    createBooking
  );

  updateBookingPropertyContact();
}

/* =========================
   BOOKING PROPERTY CONTACT
========================= */

function updateBookingPropertyContact() {
  const select =
    $('#bookingProperty');

  const contactBox =
    $('#bookingPropertyContact');

  if (!select || !contactBox) {
    return;
  }

  const property =
    state.properties.find(
      (item) =>
        Number(item.id) ===
        Number(select.value)
    );

  if (!property) {
    contactBox.style.display =
      'none';

    contactBox.innerHTML = '';

    return;
  }

  const contactPhone =
    property.contact_phone ||
    '';

  if (!contactPhone) {
    contactBox.style.display =
      'block';

    contactBox.innerHTML = `
      <strong>
        Payment & Contact
      </strong>

      <p
        class="muted"
        style="margin:6px 0 0;"
      >
        Contact information has not
        been provided yet.
      </p>
    `;

    return;
  }

  const safePhone =
    phoneForLink(
      contactPhone
    );

  contactBox.style.display =
    'block';

  contactBox.innerHTML = `
    <strong>
      Payment & Contact
    </strong>

    <p
      class="muted"
      style="margin:6px 0;"
    >
      Contact this number for payment
      instructions or more information:
    </p>

    <a
      href="tel:${esc(safePhone)}"
      style="font-weight:700;"
    >
      ${esc(contactPhone)}
    </a>
  `;
}

/* =========================
   CREATE BOOKING
========================= */

async function createBooking(event) {
  event.preventDefault();

  const bookingError =
    $('#bookingError');

  if (bookingError) {
    bookingError.textContent = '';
  }

  const propertyId =
    Number(
      $('#bookingProperty')
        .value
    );

  const customerName =
    $('#bookingCustomerName')
      .value
      .trim();

  const customerPhone =
    $('#bookingCustomerPhone')
      .value
      .trim();

  const startAt =
    $('#bookingStart').value;

  const endAt =
    $('#bookingEnd').value;

  const totalAmount =
    Number(
      $('#bookingTotal').value
    );

  const depositAmount =
    Number(
      $('#bookingDeposit').value
    );

  const notes =
    $('#bookingNotes')
      .value
      .trim();

  if (!propertyId) {
    if (bookingError) {
      bookingError.textContent =
        'Please select a property.';
    }

    return;
  }

  if (!customerName) {
    if (bookingError) {
      bookingError.textContent =
        'Please enter the customer name.';
    }

    return;
  }

  if (!customerPhone) {
    if (bookingError) {
      bookingError.textContent =
        'Please enter the customer phone number.';
    }

    return;
  }

  if (!startAt || !endAt) {
    if (bookingError) {
      bookingError.textContent =
        'Please select the start and end date/time.';
    }

    return;
  }

  if (
    new Date(endAt) <=
    new Date(startAt)
  ) {
    if (bookingError) {
      bookingError.textContent =
        'End time must be after start time.';
    }

    return;
  }

  if (
    !Number.isFinite(totalAmount) ||
    totalAmount < 0
  ) {
    if (bookingError) {
      bookingError.textContent =
        'Please enter a valid total amount.';
    }

    return;
  }

  if (
    !Number.isFinite(depositAmount) ||
    depositAmount < 0
  ) {
    if (bookingError) {
      bookingError.textContent =
        'Please enter a valid deposit amount.';
    }

    return;
  }

  if (
    depositAmount >
    totalAmount
  ) {
    if (bookingError) {
      bookingError.textContent =
        'Deposit cannot exceed the total amount.';
    }

    return;
  }

  try {

    await api(
      '/bookings',
      {
        method: 'POST',

        body: JSON.stringify({
          property_id:
            propertyId,

          customer_name:
            customerName,

          customer_phone:
            customerPhone,

          start_at:
            new Date(
              startAt
            ).toISOString(),

          end_at:
            new Date(
              endAt
            ).toISOString(),

          total_amount:
            totalAmount,

          deposit_amount:
            depositAmount,

          status:
            'confirmed',

          notes:
            notes || null
        })
      }
    );

    /*
      Find the property after successful
      booking so the customer can immediately
      see where to contact the owner.
    */
    const bookedProperty =
      state.properties.find(
        (property) =>
          Number(property.id) ===
          Number(propertyId)
      );

    const contactPhone =
      bookedProperty?.contact_phone ||
      '';

    const safePhone =
      phoneForLink(
        contactPhone
      );

    closeModal();

    await load();

    state.view =
      'bookings';

    render();

    if (contactPhone) {
      alert(
        `Booking created successfully.\n\n` +
        `For payment instructions or more information, ` +
        `contact the property owner on ${contactPhone}.`
      );
    } else {
      alert(
        'Booking created successfully.\n\n' +
        'The property owner has not provided a contact/payment number yet.'
      );
    }

  } catch (error) {

    if (bookingError) {
      bookingError.textContent =
        error.message;
    }

  }
}

/* =========================
   CLOSE MODAL
========================= */

function closeModal() {
  const modal =
    $('#modal');

  if (!modal) {
    return;
  }

  modal
    .classList
    .add('hidden');
}

/* =========================
   MAKE FUNCTIONS AVAILABLE
   TO INLINE HTML BUTTONS
========================= */

window.openPropertyModal =
  openPropertyModal;

window.goToView =
  goToView;

window.openModal =
  openModal;

window.openModalForProperty =
  openModalForProperty;

window.cancelBooking =
  cancelBooking;

window.deleteProperty =
  deleteProperty;

window.closeModal =
  closeModal;

/* =========================
   START APPLICATION
========================= */

function startApplication() {
  setupLoginForm();

  setupAuthSwitching();

  setupRegisterForm();

  setupLogout();

  if (state.token) {
    showApp();
  }
}

if (
  document.readyState ===
  'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    startApplication
  );
} else {
  startApplication();
}