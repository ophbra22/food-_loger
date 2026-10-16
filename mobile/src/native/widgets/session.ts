import type {WidgetLifecycle} from './lifecycle';
import {widgetPort} from './native';
let current:WidgetLifecycle|null=null;
let generation=0,authorized=false;
/** Only AuthProvider opens this gate after authenticated restoration/replacement. */
export function allowWidgetSession(){generation++;authorized=true;}
export function captureWidgetSession(){const captured=generation;return ()=>authorized&&generation===captured;}
export function stopWidgetSession(endAccount=false){generation++;if(endAccount)authorized=false;const old=current;current=null;if(old)old.close();else widgetPort.clear();}
export function startWidgetSession(create:()=>WidgetLifecycle){if(!authorized)throw Error('Widget account closed');stopWidgetSession();const next=create();current=next;return next;}
export function releaseWidgetSession(value:WidgetLifecycle){if(current===value)stopWidgetSession();}
