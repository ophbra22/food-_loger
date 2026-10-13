// Exact rational arithmetic on finite decimal inputs, converted to a JS number only at boundaries.
// No display rounding and no addition of binary floating-point intermediates.
type Fraction = [bigint,bigint];
export function fraction(n:number):Fraction {
  if (!Number.isFinite(n) || n<0 || n>1e8) throw new Error('Invalid nutrient or quantity');
  const [coefficient, exponent='0'] = n.toString().split('e');
  const [whole, decimals=''] = coefficient.split('.');
  const power=decimals.length-Number(exponent);
  const numerator=BigInt(whole+decimals);
  return power>=0 ? [numerator,10n**BigInt(power)] : [numerator*10n**BigInt(-power),1n];
}
export function multiply(a:number,b:number,divisor=1) {
  const [an,ad]=fraction(a), [bn,bd]=fraction(b), [cn,cd]=fraction(divisor);
  if(cn===0n) throw new Error('Zero divisor');
  return Number(an*bn*cd)/Number(ad*bd*cn);
}
export function sum(values:number[]) {
  const result=values.reduce<Fraction>(([an,ad],value)=>{
    const [bn,bd]=fraction(value); const denominator=ad>bd?ad:bd;
    return [an*(denominator/ad)+bn*(denominator/bd),denominator];
  },[0n,1n]);
  return Number(result[0])/Number(result[1]);
}
