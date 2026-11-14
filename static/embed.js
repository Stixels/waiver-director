/*!
 * Waiver Director website widget.
 *
 * Paste the snippet from Settings > Website widget into any page:
 *
 *   <script src="https://<app>/embed.js"
 *     data-waiver-url="https://<app>/w/<slug>"
 *     data-mode="button"            (or "inline")
 *     data-label="Sign waiver"
 *     data-color="#111827"
 *     async></script>
 *
 * "button" renders a button where the script tag sits; clicking it opens the waiver in a modal.
 * "inline" renders the waiver form in place and grows the frame to fit its content.
 * Any element with data-waiver-director-open="<waiver url>" also opens the modal when clicked.
 *
 * The embedded page posts { source: 'waiver-director', type: 'resize' | 'submitted' } messages;
 * keep that shape in sync with src/lib/embed/widget.ts.
 */
(function () {
	'use strict';

	var SOURCE = 'waiver-director';
	var DEFAULT_LABEL = 'Sign waiver';
	var DEFAULT_COLOR = '#111827';
	var HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
	var win = window;
	var doc = document;

	var registry = (win.__waiverDirectorWidget = win.__waiverDirectorWidget || {
		frames: [],
		listening: false,
		openBound: false
	});

	function parseWaiverUrl(raw) {
		if (!raw) return null;
		var url;
		try {
			url = new URL(raw, doc.baseURI);
		} catch {
			return null;
		}
		if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
		if (!/^\/w\/[^/]+\/?$/.test(url.pathname)) return null;
		url.searchParams.set('embed', '1');
		url.hash = '';
		return url;
	}

	function textColorFor(background) {
		var hex = background.slice(1);
		if (hex.length === 3) {
			hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
		}
		function channel(offset) {
			var value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
			return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
		}
		var luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
		return luminance > 0.4 ? '#111827' : '#ffffff';
	}

	function dispatch(target, name) {
		var event;
		try {
			event = new CustomEvent(name, { bubbles: true });
		} catch {
			event = doc.createEvent('CustomEvent');
			event.initCustomEvent(name, true, false, null);
		}
		target.dispatchEvent(event);
	}

	function createFrame(url, title) {
		var frame = doc.createElement('iframe');
		frame.src = url.toString();
		frame.title = title || 'Waiver form';
		frame.setAttribute('loading', 'lazy');
		frame.setAttribute('allow', 'clipboard-write');
		frame.style.border = '0';
		frame.style.width = '100%';
		frame.style.display = 'block';
		frame.style.background = 'transparent';
		return frame;
	}

	function trackFrame(frame, url, options) {
		registry.frames.push({
			frame: frame,
			origin: url.origin,
			autoHeight: Boolean(options.autoHeight),
			onSubmitted: options.onSubmitted || null,
			host: options.host
		});
		listen();
	}

	function untrackFrame(frame) {
		registry.frames = registry.frames.filter(function (entry) {
			return entry.frame !== frame;
		});
	}

	function listen() {
		if (registry.listening) return;
		registry.listening = true;
		win.addEventListener('message', function (event) {
			var data = event.data;
			if (!data || typeof data !== 'object' || data.source !== SOURCE) return;
			for (var i = 0; i < registry.frames.length; i++) {
				var entry = registry.frames[i];
				if (entry.frame.contentWindow !== event.source || entry.origin !== event.origin) continue;

				if (data.type === 'resize' && entry.autoHeight) {
					var height = Number(data.height);
					if (isFinite(height) && height > 0) {
						entry.frame.style.height = Math.min(Math.ceil(height), 20000) + 'px';
					}
				} else if (data.type === 'submitted') {
					if (entry.onSubmitted) entry.onSubmitted();
					dispatch(entry.host, 'waiver-director:submitted');
				}
				return;
			}
		});
	}

	/* ---------- Modal ---------- */

	var modal = null;

	function closeModal() {
		if (!modal) return;
		var current = modal;
		modal = null;
		untrackFrame(current.frame);
		doc.removeEventListener('keydown', current.onKeydown, true);
		doc.documentElement.style.overflow = current.previousOverflow;
		if (current.overlay.parentNode) current.overlay.parentNode.removeChild(current.overlay);
		if (current.returnFocus && typeof current.returnFocus.focus === 'function') {
			current.returnFocus.focus();
		}
		dispatch(current.trigger, 'waiver-director:close');
	}

	function openModal(url, trigger) {
		closeModal();

		var overlay = doc.createElement('div');
		overlay.setAttribute('role', 'dialog');
		overlay.setAttribute('aria-modal', 'true');
		overlay.setAttribute('aria-label', 'Sign waiver');
		overlay.style.cssText =
			'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;' +
			'padding:16px;box-sizing:border-box;background:rgba(15,23,42,0.6);';

		var panel = doc.createElement('div');
		panel.style.cssText =
			'position:relative;width:100%;max-width:760px;height:100%;max-height:960px;background:#fff;' +
			'border-radius:16px;overflow:hidden;box-shadow:0 24px 64px rgba(15,23,42,0.35);';

		var close = doc.createElement('button');
		close.type = 'button';
		close.setAttribute('aria-label', 'Close waiver');
		close.innerHTML = '&times;';
		close.style.cssText =
			'position:absolute;top:10px;right:10px;z-index:1;width:36px;height:36px;border:0;border-radius:999px;' +
			'background:rgba(15,23,42,0.75);color:#fff;font:400 24px/36px system-ui,sans-serif;cursor:pointer;padding:0;';
		close.addEventListener('click', closeModal);

		var frame = createFrame(url, 'Waiver form');
		frame.removeAttribute('loading');
		frame.style.height = '100%';

		panel.appendChild(close);
		panel.appendChild(frame);
		overlay.appendChild(panel);
		overlay.addEventListener('click', function (event) {
			if (event.target === overlay) closeModal();
		});

		function onKeydown(event) {
			if (event.key === 'Escape') {
				event.preventDefault();
				closeModal();
			} else if (event.key === 'Tab') {
				// Keep focus inside the dialog: the close button and the frame are the only stops.
				var active = doc.activeElement;
				if (active !== close && active !== frame) {
					event.preventDefault();
					close.focus();
				}
			}
		}

		modal = {
			overlay: overlay,
			frame: frame,
			trigger: trigger,
			returnFocus: doc.activeElement,
			previousOverflow: doc.documentElement.style.overflow,
			onKeydown: onKeydown
		};

		trackFrame(frame, url, { autoHeight: false, host: trigger });
		doc.documentElement.style.overflow = 'hidden';
		doc.addEventListener('keydown', onKeydown, true);
		doc.body.appendChild(overlay);
		close.focus();
		dispatch(trigger, 'waiver-director:open');
	}

	/* ---------- Mounting ---------- */

	function mountButton(script, url) {
		var label = (script.getAttribute('data-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40);
		var color = (script.getAttribute('data-color') || '').trim();
		if (!HEX_COLOR.test(color)) color = DEFAULT_COLOR;

		var button = doc.createElement('button');
		button.type = 'button';
		button.className = 'waiver-director-button';
		button.textContent = label || DEFAULT_LABEL;
		button.style.cssText =
			'display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 22px;' +
			'border:0;border-radius:999px;cursor:pointer;font:600 15px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;' +
			'letter-spacing:0.01em;box-shadow:0 1px 2px rgba(15,23,42,0.18);';
		button.style.background = color;
		button.style.color = textColorFor(color);
		button.addEventListener('click', function () {
			openModal(url, button);
		});

		script.parentNode.insertBefore(button, script.nextSibling);
	}

	function mountInline(script, url) {
		var wrapper = doc.createElement('div');
		wrapper.className = 'waiver-director-inline';
		wrapper.style.cssText = 'width:100%;border-radius:16px;overflow:hidden;';

		var frame = createFrame(url, 'Waiver form');
		frame.style.height = '920px';
		wrapper.appendChild(frame);
		script.parentNode.insertBefore(wrapper, script.nextSibling);

		trackFrame(frame, url, {
			autoHeight: true,
			host: wrapper,
			onSubmitted: function () {
				if (typeof wrapper.scrollIntoView === 'function') {
					wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			}
		});
	}

	function mountScript(script) {
		if (script.getAttribute('data-waiver-director-mounted') === 'true') return;
		script.setAttribute('data-waiver-director-mounted', 'true');

		var url = parseWaiverUrl(script.getAttribute('data-waiver-url'));
		if (!url) {
			if (win.console) win.console.warn('[waiver-director] data-waiver-url must be a waiver link.');
			return;
		}
		if (!script.parentNode) return;

		if (script.getAttribute('data-mode') === 'inline') {
			mountInline(script, url);
		} else {
			mountButton(script, url);
		}
	}

	function bindOpenTriggers() {
		if (registry.openBound) return;
		registry.openBound = true;
		doc.addEventListener('click', function (event) {
			var target = event.target;
			var trigger = target && target.closest ? target.closest('[data-waiver-director-open]') : null;
			if (!trigger) return;
			var url = parseWaiverUrl(
				trigger.getAttribute('data-waiver-director-open') || trigger.getAttribute('href')
			);
			if (!url) return;
			event.preventDefault();
			openModal(url, trigger);
		});
	}

	function mountAll() {
		var scripts = doc.querySelectorAll('script[data-waiver-url]');
		for (var i = 0; i < scripts.length; i++) mountScript(scripts[i]);
	}

	bindOpenTriggers();
	if (doc.readyState === 'loading') {
		doc.addEventListener('DOMContentLoaded', mountAll);
	} else {
		mountAll();
	}
})();
