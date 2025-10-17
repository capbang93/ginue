var num = document.getElementsByTagName("input");
var field = document.querySelector('#field');

for(i = 0; i<num.length;i++ ) {
    //0~9, + - * / %
   if(num[i].value !='=' && num[i].value !='C'){
      num[i].onclick = function(){
          if(field.value=='0'){
              field.value='';
          } 
          field.value += this.value;
      }
    } //clear
    else if(num[i].value=='C'){
       num[i].onclick = function(){
           field.value = '0';
       }
    } // =
    else if(num[i].value=='='){
      num[i].onclick = function(){
         try{
            field.value = eval(field.value);
         } catch(err){
            field.value = "입력오류"; 
         }
      }
   }
}