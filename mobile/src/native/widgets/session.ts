import type {WidgetLifecycle} from './lifecycle';
import {widgetPort} from './native';
let current:WidgetLifecycle|null=null;
export function stopWidgetSession(){const old=current;current=null;if(old)old.close();else widgetPort.clear();}
export function startWidgetSession(create:()=>WidgetLifecycle){stopWidgetSession();const next=create();current=next;return next;}
export function releaseWidgetSession(value:WidgetLifecycle){if(current===value)stopWidgetSession();}
