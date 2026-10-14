import type {LibraryEntry} from '@/domain/library';
export function libraryEntry():LibraryEntry {
 return {kind:'meal',id:'a'.repeat(32),version:1,name:'Saved salad',servings:1,favorite:false,
 draft:{schema_version:'2',calculation_version:'exact-v1',input_method:'repeat',status:'draft',local_date:'2026-10-13',occurred_at:null,timezone_id:null,meal_category:'lunch',warnings:[],items:[{
 id:'ingredient',display_name:'Salad',portion:{quantity:100,unit:'g',normalized_g:100,estimated:false},nutrition_per_100:{basis:'g',energy_kcal:100,protein_g:null,carbs_g:10,fat_g:5},source:{provider:'manual',reference_id:'source-id',version:'saved-v1',verified_status:'user_confirmed'},warnings:[],manual_override:false}]} };
}
