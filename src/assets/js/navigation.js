/**
 * Mobile menu toggle and sub-menu dropdown toggles.
 * Vanilla-JS port of Twenty Sixteen's js/functions.js (which needs jQuery).
 */
( function() {
	var expandText = 'Vis undermenu';
	var collapseText = 'Skjul undermenu';

	var masthead = document.getElementById( 'masthead' );
	var menuToggle = document.getElementById( 'menu-toggle' );
	var siteHeaderMenu = document.getElementById( 'site-header-menu' );
	var siteNavigation = document.getElementById( 'site-navigation' );

	// Dropdown toggle buttons next to every menu item that has a sub-menu (header and footer menus).
	function initMainNavigation( container ) {
		container.querySelectorAll( '.menu-item-has-children' ).forEach( function( item ) {
			item.setAttribute( 'aria-haspopup', 'true' );

			var link = item.querySelector( ':scope > a' );
			var subMenu = item.querySelector( ':scope > .sub-menu' );
			if ( ! link || ! subMenu ) {
				return;
			}

			var button = document.createElement( 'button' );
			button.className = 'dropdown-toggle';
			button.setAttribute( 'aria-expanded', 'false' );
			var label = document.createElement( 'span' );
			label.className = 'screen-reader-text';
			label.textContent = expandText;
			button.appendChild( label );
			link.after( button );

			// Open the branch that contains the current page.
			if ( item.classList.contains( 'current-menu-ancestor' ) ) {
				button.classList.add( 'toggled-on' );
				subMenu.classList.add( 'toggled-on' );
				button.setAttribute( 'aria-expanded', 'true' );
				label.textContent = collapseText;
			}

			button.addEventListener( 'click', function( e ) {
				e.preventDefault();
				var open = button.classList.toggle( 'toggled-on' );
				subMenu.classList.toggle( 'toggled-on', open );
				button.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
				label.textContent = open ? collapseText : expandText;
			} );
		} );
	}

	document.querySelectorAll( '.main-navigation' ).forEach( initMainNavigation );

	if ( ! menuToggle || ! siteHeaderMenu ) {
		return;
	}

	// Mobile menu toggle.
	menuToggle.addEventListener( 'click', function() {
		var open = menuToggle.classList.toggle( 'toggled-on' );
		siteHeaderMenu.classList.toggle( 'toggled-on', open );
		menuToggle.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
		if ( siteNavigation ) {
			siteNavigation.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
		}
	} );

	// Keyboard focus reveals sub-menu items (class `focus` is styled by the theme).
	if ( siteNavigation ) {
		siteNavigation.querySelectorAll( 'a' ).forEach( function( a ) {
			function toggleFocus() {
				var el = a.parentNode;
				while ( el && el !== siteNavigation ) {
					if ( el.classList && el.classList.contains( 'menu-item' ) ) {
						el.classList.toggle( 'focus' );
					}
					el = el.parentNode;
				}
			}
			a.addEventListener( 'focus', toggleFocus );
			a.addEventListener( 'blur', toggleFocus );
		} );

		// Touch devices: first tap on a parent item opens its sub-menu instead of following the link.
		if ( 'ontouchstart' in window ) {
			var touchLinks = siteNavigation.querySelectorAll( '.menu-item-has-children > a' );
			var onTouch = function( e ) {
				if ( window.innerWidth < 910 ) {
					return;
				}
				var li = e.currentTarget.parentNode;
				if ( ! li.classList.contains( 'focus' ) ) {
					e.preventDefault();
					Array.prototype.forEach.call( li.parentNode.children, function( sib ) {
						if ( sib !== li ) {
							sib.classList.remove( 'focus' );
						}
					} );
					li.classList.add( 'focus' );
				}
			};
			touchLinks.forEach( function( a ) {
				a.addEventListener( 'touchstart', onTouch );
			} );
			document.body.addEventListener( 'touchstart', function( e ) {
				if ( ! e.target.closest( '.main-navigation li' ) ) {
					document.querySelectorAll( '.main-navigation li.focus' ).forEach( function( li ) {
						li.classList.remove( 'focus' );
					} );
				}
			} );
		}
	}

	// ARIA attributes only apply to the collapsed (mobile) layout.
	function onResizeARIA() {
		if ( window.innerWidth < 910 ) {
			var open = menuToggle.classList.contains( 'toggled-on' ) ? 'true' : 'false';
			menuToggle.setAttribute( 'aria-expanded', open );
			if ( siteNavigation ) {
				siteNavigation.setAttribute( 'aria-expanded', open );
			}
			menuToggle.setAttribute( 'aria-controls', 'site-navigation' );
		} else {
			menuToggle.removeAttribute( 'aria-expanded' );
			if ( siteNavigation ) {
				siteNavigation.removeAttribute( 'aria-expanded' );
			}
			menuToggle.removeAttribute( 'aria-controls' );
		}
	}
	window.addEventListener( 'resize', onResizeARIA );
	onResizeARIA();
}() );
