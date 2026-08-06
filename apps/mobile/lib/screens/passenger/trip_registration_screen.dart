import 'package:flutter/material.dart';

import '../../services/api_service.dart';

class TripRegistrationScreen extends StatefulWidget {
  const TripRegistrationScreen({super.key});

  @override
  State<TripRegistrationScreen> createState() => _TripRegistrationState();
}

class _TripRegistrationState extends State<TripRegistrationScreen> {
  final name = TextEditingController();
  final identity = TextEditingController();
  final phone = TextEditingController();
  String passengerType = 'local';
  String gender = 'other';
  String ageCategory = 'adult';
  String? invitationCode;
  Future<Map<String, dynamic>>? preview;
  bool submitting = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final code = ModalRoute.of(context)?.settings.arguments as String?;
    if (code != null && code != invitationCode) {
      invitationCode = code;
      preview = ApiService.instance.passengerTrip(code);
    }
  }

  @override
  void dispose() {
    name.dispose();
    identity.dispose();
    phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Passenger Registration')),
        body: invitationCode == null
            ? const Center(child: Text('This trip QR code is invalid or expired.'))
            : FutureBuilder<Map<String, dynamic>>(
                future: preview,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return _messageState(snapshot.error.toString());
                  }
                  final trip = snapshot.data!;
                  if (trip['acceptingPassengers'] != true) {
                    return _messageState('This trip is no longer accepting passengers.');
                  }
                  return SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(trip['boatName']?.toString() ?? 'Trip',
                          style: Theme.of(context).textTheme.headlineSmall),
                      Text('${trip['registrationNumber']} · ${trip['scheduledDepartureUtc']}'),
                      const SizedBox(height: 24),
                      field(name, 'Full Name'),
                      field(identity, passengerType == 'foreign' ? 'Passport Number' : 'NIC Number'),
                      field(phone, 'Phone Number', keyboard: TextInputType.phone),
                      dropdown('Passenger Type', passengerType,
                          const {'local': 'Local', 'foreign': 'Foreign'},
                          (value) => setState(() => passengerType = value!)),
                      dropdown('Gender', gender,
                          const {'male': 'Male', 'female': 'Female', 'other': 'Other'},
                          (value) => setState(() => gender = value!)),
                      dropdown('Age Category', ageCategory,
                          const {'adult': 'Adult', 'child': 'Child', 'small': 'Small Child'},
                          (value) => setState(() => ageCategory = value!)),
                      const SizedBox(height: 24),
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton.icon(
                          onPressed: submitting ? null : register,
                          icon: submitting
                              ? const SizedBox(width: 18, height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.how_to_reg),
                          label: const Text('Register Passenger'),
                        ),
                      ),
                    ]),
                  );
                },
              ),
      );

  Future<void> register() async {
    if ([name, identity, phone].any((controller) => controller.text.trim().isEmpty)) {
      _snack('Complete all passenger details.');
      return;
    }
    setState(() => submitting = true);
    try {
      final result = await ApiService.instance.registerPassenger(invitationCode!, {
        'name': name.text.trim(),
        'identificationNumber': identity.text.trim(),
        'phoneNumber': phone.text.trim(),
        'passengerType': passengerType,
        'gender': gender,
        'ageCategory': ageCategory,
        'selfCareConfirmed': false,
      });
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Registration successful'),
          content: Text('${result['name']} is registered for this trip.'),
          actions: [TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Done'),
          )],
        ),
      );
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      _snack(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  Widget field(TextEditingController controller, String label,
          {TextInputType? keyboard}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: TextField(controller: controller, keyboardType: keyboard,
          decoration: InputDecoration(labelText: label, border: const OutlineInputBorder())),
      );

  Widget dropdown(String label, String value, Map<String, String> values,
          ValueChanged<String?> changed) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: DropdownButtonFormField<String>(value: value, onChanged: changed,
          decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
          items: values.entries.map((entry) => DropdownMenuItem(
            value: entry.key, child: Text(entry.value))).toList()),
      );

  Widget _messageState(String message) => Center(child: Padding(
    padding: const EdgeInsets.all(24),
    child: Text(message.replaceFirst('Exception: ', ''), textAlign: TextAlign.center),
  ));

  void _snack(String message) {
    if (mounted) ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }
}
