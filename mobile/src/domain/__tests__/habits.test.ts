import {validateHabits,validateHabitPreferences} from '../habits';
const preferences={version:0,timezone_id:'Asia/Jerusalem',language:'he',muted:false,breakfast:null,lunch:'12:00',dinner:null,water:null,evening:null,quiet_start:'22:00',quiet_end:'07:00'};
test.each([{lunch:'24:00'},{lunch:'12:75'},{version:-1},{muted:'false'},{timezone_id:'Mars/Zone'},{quiet_end:null}])('reject malformed preferences %j',patch=>{expect(()=>validateHabitPreferences({...preferences,...patch})).toThrow();});
test('accepts valid zero streak and rejects impossible counts',()=>{
 expect(validateHabits({preferences,streak:{current:0,longest:0,logged_days:0}}).streak.current).toBe(0);
 expect(()=>validateHabits({preferences,streak:{current:2,longest:1,logged_days:1}})).toThrow();
 expect(()=>validateHabits({preferences,streak:{current:null,longest:0,logged_days:0}})).toThrow();
});
