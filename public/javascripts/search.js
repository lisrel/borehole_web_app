$(function(){
	$.ajax({
		type: 'GET',
		url: '/api/parcels',
		success: function(number){

			var numbers= '';
			$.each(number, function(key, value){
				numbers+= '<tr>';
				numbers+= '<td>' + value.f1 + '</td>';
				numbers+= '<td>' + value.f4 + '</td>';
				numbers+= '<td>' + value.f2 + '</td>';
				numbers+= '<td>' + value.f3 + '</td>';
				numbers+= '<td>' + value.f9 + '</td>';
				numbers+= '<td>' + value.f8 + '</td>';
				numbers+= '<td>' + value.f7 + '</td>';
				numbers+= '</tr>';
			});
			$('#search1').append(numbers);
		},
		error: function(){
			alert('error loading data');
		}
	});
});