import {Platform} from 'react-native';
import {healthPort as iosPort,healthEnabled as iosEnabled} from './ios';
import {connectPort,connectEnabled} from './android';
export const isHealthConnect=Platform.OS==='android';
export const healthPort=isHealthConnect?connectPort:iosPort;
export const healthEnabled=isHealthConnect?connectEnabled:iosEnabled;
export const healthStorageName=isHealthConnect?'health-connect-sync':'health-sync';
