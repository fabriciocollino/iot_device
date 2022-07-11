$(function(){

	$('#text-list-networks').hide();
	
	$.get("/ssids", function(data){
		if(data.length == 0){
			$('.before-submit').hide();
			$('#no-networks-message').removeClass('hidden');
		} else {
			$.each(data, function(i, val){
				$("#select-ssid").append($('<option>').attr('val', val.ssid).text(val.ssid));
			});
		}
	});


	$('#type-checkbox-ssid').click(function(){
		if ($(this).is(":checked")) {
			$('#select-ssid').attr("name", "ssid-B");
			$('#select-ssid').attr("disabled", "disabled");
			$('#select-list-networks').hide();
			
			$('#text-ssid').attr("name", "ssid");
			$('#text-ssid').removeAttr('disabled');
			$('#text-list-networks').show();
		}
		else{
			$('#select-ssid').attr("name", "ssid");
			$('#select-ssid').removeAttr('disabled');
			$('#select-list-networks').show();
			
			$('#text-ssid').attr("name", "ssid-B");
			$('#text-ssid').attr("disabled", "disabled");
			$('#text-list-networks').hide();
			
		}
	});
	
	

	$('#connect-form').submit(function(ev){
		$.post('/connect', $('#connect-form').serialize(), function(data){
			$('.before-submit').hide();
			$('#submit-message').removeClass('hidden');
		});
		ev.preventDefault();
	});

});

