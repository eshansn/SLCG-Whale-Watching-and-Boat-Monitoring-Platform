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
  ApiService._();
  static final instance = ApiService._();
  static const _storage = FlutterSecureStorage();
  static const baseUrl = String.fromEnvironment('API_BASE_URL',
      defaultValue: 'http://localhost:8080');
  Session? session;
  HubConnection? _hub;
  String? get role =>
      session?.roles.isNotEmpty == true ? session!.roles.first : null;

  Future<String?> restore() async {
    final refresh = await _storage.read(key: 'refresh_token');
    if (refresh == null) return null;
    try {
      final data = await _post('/api/auth/refresh', {'refreshToken': refresh},
          authenticated: false);
      await _setSession(data);
      return role;
    } catch (_) {
      await logout();
      return null;
    }
  }

  Future<String> login(String email, String password) async {
    final data = await _post(
        '/api/auth/login', {'email': email, 'password': password},
        authenticated: false);
    await _setSession(data);
    return role!;
  }

  Future<void> logout() async {
    session = null;
    await _storage.delete(key: 'refresh_token');
    await _hub?.stop();
    notifyListeners();
  }

  Future<List<Map<String, dynamic>>> trips() async =>
      (await _get('/api/operations/trips') as List)
          .cast<Map<String, dynamic>>();
  Future<List<Map<String, dynamic>>> boats() async =>
      (await _get('/api/operations/boats') as List)
          .cast<Map<String, dynamic>>();
  Future<List<Map<String, dynamic>>> shoreWildlifeTrips() async =>
      (await _get('/api/shore-wildlife/trips') as List)
          .cast<Map<String, dynamic>>();
  Future<Map<String, dynamic>> shoreWildlifeAttendance(String tripId) async =>
      (await _get('/api/shore-wildlife/trips/$tripId/attendance') as Map)
          .cast<String, dynamic>();
  Future<List<Map<String, dynamic>>> shoreWildlifeRecords() async =>
      (await _get('/api/shore-wildlife/records') as List)
          .cast<Map<String, dynamic>>();
  Future<Map<String, dynamic>> createShoreWildlifeRecord(
          Map<String, dynamic> body) =>
      _sendMap('POST', '/api/shore-wildlife/records', body);
  Future<Map<String, dynamic>> requestShoreWildlifeSignatures(
          String id, Map<String, dynamic> body) =>
      _sendMap('PUT', '/api/shore-wildlife/records/$id', body);
  Future<Map<String, dynamic>> signShoreWildlifeRecord(
          String id, Map<String, dynamic> body) =>
      _sendMap('POST', '/api/shore-wildlife/records/$id/sign', body);
  Future<Map<String, dynamic>> approveShoreWildlifeTrip(
          String tripId, String approval) =>
      _sendMap('PATCH', '/api/shore-wildlife/trips/$tripId/approval',
          {'approval': approval});
  Future<List<Map<String, dynamic>>> tripPassengers(String tripId) async =>
      (await _get('/api/operations/trips/$tripId/passengers?updated=${DateTime.now().millisecondsSinceEpoch}')
              as List)
          .cast<Map<String, dynamic>>();
  Future<void> refreshData() async {
    await trips();
    notifyListeners();
  }

  Future<void> approve(String id, String approval) async => _send('PATCH',
      '/api/operations/trips/$id/shore-approval', {'approval': approval});
  Future<void> updateStatus(String id, String status) async =>
      _send('PATCH', '/api/operations/trips/$id/status', {'status': status});
  Future<void> createTrip(String boatId, DateTime departure,
          {String route = 'Mirissa – Dondra Head',
          int passengerCount = 0}) async =>
      _send('POST', '/api/operations/trips', {
        'boatId': boatId,
        'scheduledDepartureUtc': departure.toUtc().toIso8601String(),
        'route': route,
        'passengerCount': passengerCount
      });
  Future<void> createBoat(
          {required String name,
          required String registrationNumber,
          required String hullNumber,
          required double length,
          required double width,
          required int capacity}) async =>
      _send('POST', '/api/operations/boats', {
        'name': name,
        'registrationNumber': registrationNumber,
        'registrationDate': DateTime.now().toIso8601String().substring(0, 10),
        'hullNumber': hullNumber,
        'lengthMeters': length,
        'widthMeters': width,
        'maximumCapacity': capacity
      });

  Future<void> _setSession(Map<String, dynamic> data) async {
    session = Session(data['accessToken'], data['refreshToken'],
        List<String>.from(data['roles']));
    await _storage.write(key: 'refresh_token', value: session!.refreshToken);
    notifyListeners();
    unawaited(_connect());
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (session != null) 'Authorization': 'Bearer ${session!.accessToken}'
      };
  Future<dynamic> _get(String path) async {
    try {
      final r = await http
          .get(Uri.parse('$baseUrl$path'), headers: _headers)
          .timeout(const Duration(seconds: 15));
      return _decode(r);
    } on TimeoutException {
      throw Exception(
          'The WWMS API did not respond. Check the server and your connection.');
    } on http.ClientException {
      throw Exception(
          'Cannot reach the WWMS API at $baseUrl. Check the server and your connection.');
    }
  }

  Future<Map<String, dynamic>> _post(String path, Object body,
      {bool authenticated = true}) async {
    try {
      final r = await http
          .post(Uri.parse('$baseUrl$path'),
              headers: authenticated
                  ? _headers
                  : {'Content-Type': 'application/json'},
              body: jsonEncode(body))
          .timeout(const Duration(seconds: 10));
      return (_decode(r) as Map).cast<String, dynamic>();
    } on TimeoutException {
      throw Exception(
          'Cannot reach the WWMS API at $baseUrl. Confirm that the backend is running.');
    } on http.ClientException {
      throw Exception(
          'Cannot reach the WWMS API at $baseUrl. Confirm that the backend is running.');
    }
  }

  Future<void> _send(String method, String path, Object body) async {
    await _sendResponse(method, path, body);
  }

  Future<Map<String, dynamic>> _sendMap(
      String method, String path, Object body) async {
    final response = await _sendResponse(method, path, body);
    final decoded = _decode(response);
    if (decoded is! Map)
      throw Exception('The server returned an invalid response.');
    return decoded.cast<String, dynamic>();
  }

  Future<http.Response> _sendResponse(
      String method, String path, Object body) async {
    final req = http.Request(method, Uri.parse('$baseUrl$path'))
      ..headers.addAll(_headers)
      ..body = jsonEncode(body);
    try {
      final streamed = await req.send().timeout(const Duration(seconds: 15));
      final response = await http.Response.fromStream(streamed)
          .timeout(const Duration(seconds: 15));
      _decode(response);
      return response;
    } on TimeoutException {
      throw Exception(
          'The WWMS API did not respond. Check the server and your connection.');
    } on http.ClientException {
      throw Exception(
          'Cannot reach the WWMS API at $baseUrl. Check the server and your connection.');
    }
  }

  dynamic _decode(http.Response r) {
    if (r.statusCode < 200 || r.statusCode >= 300) {
      String? serverMessage;
      try {
        final payload = jsonDecode(r.body);
        if (payload is Map) {
          serverMessage = payload['message']?.toString() ??
              payload['detail']?.toString() ??
              payload['title']?.toString();
        }
      } catch (_) {
        // Use the status fallback for non-JSON error responses.
      }
      throw Exception(serverMessage ??
          (r.statusCode == 401
              ? 'Invalid email or password.'
              : r.statusCode == 403
                  ? 'You do not have permission to perform this action.'
                  : 'Request failed (${r.statusCode}).'));
    }
    return r.body.isEmpty ? null : jsonDecode(r.body);
  }

  Future<void> _connect() async {
    final currentSession = session;
    if (currentSession == null) return;
    await _hub?.stop();
    _hub = HubConnectionBuilder()
        .withUrl('$baseUrl/hubs/operations',
            options: HttpConnectionOptions(
                accessTokenFactory: () =>
                    Future.value(currentSession.accessToken)))
        .withAutomaticReconnect()
        .build();
    _hub!.on('operationsChanged', (_) {
      if (session == currentSession) notifyListeners();
    });
    try {
      await _hub!.start();
    } catch (e) {
      debugPrint('Realtime unavailable: $e');
    }
  }
}
