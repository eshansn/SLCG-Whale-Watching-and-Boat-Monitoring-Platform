import 'dart:convert';
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:signalr_netcore/signalr_client.dart';

class Session {
  final String accessToken, refreshToken;
  final List<String> roles;
  const Session(this.accessToken, this.refreshToken, this.roles);
}

class ApiService extends ChangeNotifier {
  ApiService._(); static final instance=ApiService._();
  static const _storage=FlutterSecureStorage();
  static const _configuredBaseUrl=String.fromEnvironment('API_BASE_URL');
  static const _lanBaseUrl=String.fromEnvironment('LAN_API_BASE_URL',defaultValue:'http://192.168.1.102:8080');
  String? _resolvedBaseUrl;
  String get baseUrl => _resolvedBaseUrl ?? (_configuredBaseUrl.isNotEmpty ? _configuredBaseUrl : _lanBaseUrl);
  Session? session; HubConnection? _hub;
  String? get role => session?.roles.isNotEmpty==true ? session!.roles.first : null;

  Future<String?> restore() async {
    final refresh=await _storage.read(key:'refresh_token'); if(refresh==null)return null;
    try { final data=await _post('/api/auth/refresh',{'refreshToken':refresh},authenticated:false); await _setSession(data); return role; } catch (_) { await logout(); return null; }
  }
  Future<String> login(String email,String password) async {
    if (_configuredBaseUrl.isEmpty) await _resolveServer();
    final data=await _post('/api/auth/login',{'email':email,'password':password},authenticated:false);
    await _setSession(data);return role!;
  }
  Future<void> logout() async { session=null;await _storage.delete(key:'refresh_token');await _hub?.stop();notifyListeners(); }
  Future<List<Map<String,dynamic>>> trips() async => (await _get('/api/operations/trips') as List).cast<Map<String,dynamic>>();
  Future<List<Map<String,dynamic>>> boats() async => (await _get('/api/operations/boats') as List).cast<Map<String,dynamic>>();
  Future<void> approve(String id,String approval) async => _send('PATCH','/api/operations/trips/$id/shore-approval',{'approval':approval});
  Future<void> updateStatus(String id,String status) async => _send('PATCH','/api/operations/trips/$id/status',{'status':status});
  Future<void> createTrip(String boatId,DateTime departure,{String route='Mirissa – Dondra Head',int passengerCount=0}) async => _send('POST','/api/operations/trips',{'boatId':boatId,'scheduledDepartureUtc':departure.toUtc().toIso8601String(),'route':route,'passengerCount':passengerCount});
  Future<void> createBoat({required String name,required String registrationNumber,required String hullNumber,required double length,required double width,required int capacity}) async => _send('POST','/api/operations/boats',{'name':name,'registrationNumber':registrationNumber,'registrationDate':DateTime.now().toIso8601String().substring(0,10),'hullNumber':hullNumber,'lengthMeters':length,'widthMeters':width,'maximumCapacity':capacity});

  Future<void> _setSession(Map<String,dynamic> data) async { session=Session(data['accessToken'],data['refreshToken'],List<String>.from(data['roles']));await _storage.write(key:'refresh_token',value:session!.refreshToken);notifyListeners();unawaited(_connect()); }
  Map<String,String> get _headers=>{'Content-Type':'application/json',if(session!=null)'Authorization':'Bearer ${session!.accessToken}'};
  Future<dynamic> _get(String path) async {final r=await http.get(Uri.parse('$baseUrl$path'),headers:_headers).timeout(const Duration(seconds:10));return _decode(r);}
  Future<Map<String,dynamic>> _post(String path,Object body,{bool authenticated=true}) async {try{final r=await http.post(Uri.parse('$baseUrl$path'),headers:authenticated?_headers:{'Content-Type':'application/json'},body:jsonEncode(body)).timeout(const Duration(seconds:10));return (_decode(r) as Map).cast<String,dynamic>();}on TimeoutException{throw Exception('Cannot reach the WWMS server at $baseUrl. Check that the tablet and laptop use the same Wi-Fi.');}on http.ClientException{throw Exception('Cannot reach the WWMS server at $baseUrl. Check the server address and Wi-Fi connection.');}}
  Future<void> _send(String method,String path,Object body) async {final req=http.Request(method,Uri.parse('$baseUrl$path'))..headers.addAll(_headers)..body=jsonEncode(body);final streamed=await req.send();if(streamed.statusCode<200||streamed.statusCode>=300)throw Exception('Request failed (${streamed.statusCode})');}
  dynamic _decode(http.Response r){if(r.statusCode<200||r.statusCode>=300)throw Exception(r.statusCode==401?'Invalid email or password.':'Request failed (${r.statusCode})');return r.body.isEmpty?null:jsonDecode(r.body);}
  Future<void> _resolveServer() async {
    final candidates=<String>{_lanBaseUrl,'http://10.0.2.2:8080','http://127.0.0.1:8080'};
    for(final candidate in candidates){try{final response=await http.get(Uri.parse('$candidate/health/live')).timeout(const Duration(seconds:2));if(response.statusCode==200){_resolvedBaseUrl=candidate;return;}}catch(_){}}
    _resolvedBaseUrl=_lanBaseUrl;
  }
  Future<void> _connect() async {await _hub?.stop();_hub=HubConnectionBuilder().withUrl('$baseUrl/hubs/operations',options:HttpConnectionOptions(accessTokenFactory:()=>Future.value(session!.accessToken))).withAutomaticReconnect().build();_hub!.on('operationsChanged',(_)=>notifyListeners());try{await _hub!.start();}catch(e){debugPrint('Realtime unavailable: $e');}}
}
