# `animator`

compact library for granular control over animations on the web

### build

```javascript
npm run build
```

## details

import `Animator` and `createCubicBezier` to run animations with custom timing curves. This library
can do complex DOM animations, canvas animations, discrete interpolations, and anything else that
can be controlled via javascript.

```javascript
import { Animator, CUBIC_BEZIER_PRESETS, createCubicBezier } from './animator.js';
```

### basic animation

translate a box along the x-axis:

```javascript
const box = document.querySelector('.box');

const anim = new Animator({
	duration: 800,
	easing: CUBIC_BEZIER_PRESETS.easeInOut,
	onUpdate: (x, t) => {
		box.style.transform = `translateX(${300 * x}px)`;
	},
});

anim.play();
```

### custom easing functions

use built-in presets (`linear`, `ease`, `easeIn`, `easeOut`, `easeInOut`) or create custom
cubic-bezier curves:

```javascript
const customEase = createCubicBezier(0.68, -0.55, 0.265, 1.55);

const anim = new Animator({
	duration: 1000,
	easing: customEase,
	onUpdate: progress => {
		box.style.opacity = progress;
	},
});

anim.play();
```

### control playback

```javascript
const anim = new Animator({
	duration: 2000,
	loop: 3, // true -> loop indefinitely, number -> loop n times
	onUpdate: progress => {
		/* do something each frame */
	},
	onLoop: () => {
		/* looped */
	},
	onComplete: () => {
		/* animation finished */
	},
});

anim.play(); // start or resume
anim.pause(); // pause animation
anim.seek(0.5); // jump to 50% progress
anim.reset(); // reset animation and stop
```
