/* Entry point. Kept explicit rather than relying on expo/AppEntry so the
   root component is obvious to anyone opening this folder cold. */
import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
