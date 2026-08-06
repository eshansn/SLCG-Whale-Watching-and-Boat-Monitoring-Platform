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
  Future<Map<String, dynamic>> ownerProfile() async =>
      (await _get('/api/owner/profile') as Map).cast<String, dynamic>();
  Future<Map<String, dynamic>> updateOwnerProfile(
          {required String email,
          required String phoneNumber,
          required String bio}) =>
      _sendMap('PATCH', '/api/owner/profile', {
        'email': email,
        'phoneNumber': phoneNumber,
        'bio': bio,
      });
  Future<void> uploadOwnerPhoto(String filePath) async {
    final request = http.MultipartRequest(
        'POST', Uri.parse('$baseUrl/api/owner/profile/photo'))
      ..headers['Authorization'] = 'Bearer ${session!.accessToken}'
      ..files.add(await http.MultipartFile.fromPath('photo', filePath));
    final response = await http.Response.fromStream(
        await request.send().timeout(const Duration(seconds: 20)));
    _decode(response);
  }

  Future<List<Map<String, dynamic>>> ownerCrew() async =>
      (await _get('/api/operations/owner/crew') as List)
          .cast<Map<String, dynamic>>();
  Future<List<Map<String, dynamic>>> searchOwnerCrew(String query) async =>
      (await _get('/api/operations/owner/crew/search?query=${Uri.encodeQueryComponent(query)}')
              as List)
          .cast<Map<String, dynamic>>();
  Future<Map<String, dynamic>> addOwnerCrew(String email) =>
      _sendMap('POST', '/api/operations/owner/crew', {'email': email});
  Future<void> removeOwnerCrew(String assignmentId) async =>
      _send('DELETE', '/api/operations/owner/crew/$assignmentId', const {});
  Future<void> changePassword(String currentPassword, String newPassword) =>
      _send('POST', '/api/auth/change-password', {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });
  Future<Map<String, dynamic>> crewProfile() async =>
      (await _get('/api/crew/profile') as Map).cast<String, dynamic>();
  Future<Map<String, dynamic>> updateCrewProfile(
          {required String email,
          required String phoneNumber,
          required String bio}) =>
      _sendMap('PATCH', '/api/crew/profile', {
        'email': email,
        'phoneNumber': phoneNumber,
        'bio': bio,
      });
  Future<Map<String, dynamic>> crewAttendance(String tripId) async =>
      (await _get('/api/shore/trips/$tripId/attendance') as Map)
          .cast<String, dynamic>();
  Future<List<Map<String, dynamic>>> vesselMap() async =>
      (await _get('/api/operations/vessel-map') as List)
          .cast<Map<String, dynamic>>();
  Future<void> raiseCrewSos(String tripId) =>
      _send('POST', '/api/operations/trips/$tripId/sos', const {});
  Future<Map<String, dynamic>> passengerTrip(String invitationCode) async =>
      (await _getPublic(
                  '/api/passenger/trips/${Uri.encodeComponent(invitationCode)}')
              as Map)
          .cast<String, dynamic>();
  Future<Map<String, dynamic>> registerPassenger(
          String invitationCode, Map<String, dynamic> passenger) =>
      _post(
          '/api/passenger/trips/${Uri.encodeComponent(invitationCode)}/passengers',
          passenger,
          authenticated: false);
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
        'passengerCount': passengerCount,
        'crewUserIds': <String>[]
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

  Future<dynamic> _getPublic(String path) async {
    try {
      final response = await http.get(Uri.parse('$baseUrl$path'),
          headers: const {
            'Content-Type': 'application/json'
          }).timeout(const Duration(seconds: 15));
      return _decode(response);
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
