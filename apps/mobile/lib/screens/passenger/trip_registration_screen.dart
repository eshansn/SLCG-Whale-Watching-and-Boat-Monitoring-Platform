import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import 'country_options.dart';

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
  CountryOption? country;
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
            ? const Center(
                child: Text('This trip QR code is invalid or expired.'))
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
                    return _messageState(
                        'This trip is no longer accepting passengers.');
                  }
                  return SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(trip['boatName']?.toString() ?? 'Trip',
                              style: Theme.of(context).textTheme.headlineSmall),
                          Text(
                              '${trip['registrationNumber']} · ${trip['scheduledDepartureUtc']}'),
                          const SizedBox(height: 24),
                          field(name, 'Full Name'),
                          field(
                              identity,
                              passengerType == 'foreign'
                                  ? 'Passport Number'
                                  : 'NIC Number'),
                          field(phone, 'Phone Number',
                              keyboard: TextInputType.phone),
                          dropdown(
                              'Passenger Type',
                              passengerType,
                              const {'local': 'Local', 'foreign': 'Foreign'},
                              (value) => setState(() {
                                    passengerType = value!;
                                    if (passengerType == 'local') {
                                      country = null;
                                    }
                                  })),
                          if (passengerType == 'foreign') _countryField(),
                          dropdown(
                              'Gender',
                              gender,
                              const {
                                'male': 'Male',
                                'female': 'Female',
                                'other': 'Other'
                              },
                              (value) => setState(() => gender = value!)),
                          dropdown(
                              'Age Category',
                              ageCategory,
                              const {
                                'adult': 'Adult',
                                'child': 'Child',
                                'small': 'Small Child'
                              },
                              (value) => setState(() => ageCategory = value!)),
                          const SizedBox(height: 24),
                          SizedBox(
                            width: double.infinity,
                            height: 52,
                            child: ElevatedButton.icon(
                              onPressed: submitting ? null : register,
                              icon: submitting
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2))
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
    if ([name, identity, phone]
        .any((controller) => controller.text.trim().isEmpty)) {
      _snack('Complete all passenger details.');
      return;
    }
    if (passengerType == 'foreign' && country == null) {
      _snack('Select a country for this passenger.');
      return;
    }
    setState(() => submitting = true);
    try {
      final result =
          await ApiService.instance.registerPassenger(invitationCode!, {
        'name': name.text.trim(),
        'identificationNumber': identity.text.trim(),
        'phoneNumber': phone.text.trim(),
        'passengerType': passengerType,
        if (passengerType == 'foreign') 'countryCode': country!.code,
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
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Done'),
            )
          ],
        ),
      );

      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      _snack(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  Widget _countryField() => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: InkWell(
          borderRadius: BorderRadius.circular(4),
          onTap: () async {
            final selected = await showModalBottomSheet<CountryOption>(
              context: context,
              isScrollControlled: true,
              useSafeArea: true,
              builder: (_) => const _CountryPickerSheet(),
            );
            if (selected != null && mounted) setState(() => country = selected);
          },
          child: InputDecorator(
            decoration: const InputDecoration(
              labelText: 'Country',
              border: OutlineInputBorder(),
              suffixIcon: Icon(Icons.search),
            ),
            child: Text(country == null
                ? 'Search your country...'
                : '${country!.flag} ${country!.name}'),
          ),
        ),
      );

  Widget field(TextEditingController controller, String label,
          {TextInputType? keyboard}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: TextField(
            controller: controller,
            keyboardType: keyboard,
            decoration: InputDecoration(
                labelText: label, border: const OutlineInputBorder())),
      );

  Widget dropdown(String label, String value, Map<String, String> values,
          ValueChanged<String?> changed) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: DropdownButtonFormField<String>(
            initialValue: value,
            onChanged: changed,
            decoration: InputDecoration(
                labelText: label, border: const OutlineInputBorder()),
            items: values.entries
                .map((entry) => DropdownMenuItem(
                    value: entry.key, child: Text(entry.value)))
                .toList()),
      );

  Widget _messageState(String message) => Center(
          child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(message.replaceFirst('Exception: ', ''),
            textAlign: TextAlign.center),
      ));

  void _snack(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    }
  }
}

class _CountryPickerSheet extends StatefulWidget {
  const _CountryPickerSheet();

  @override
  State<_CountryPickerSheet> createState() => _CountryPickerSheetState();
}

class _CountryPickerSheetState extends State<_CountryPickerSheet> {
  String query = '';

  @override
  Widget build(BuildContext context) {
    final normalized = query.trim().toLowerCase();
    final matches = countryOptions
        .where((option) =>
            normalized.isEmpty ||
            option.name.toLowerCase().contains(normalized) ||
            option.code.toLowerCase().startsWith(normalized))
        .toList()
      ..sort((first, second) => first.name.compareTo(second.name));

    return SizedBox(
      height: MediaQuery.sizeOf(context).height * .72,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 10),
            child: TextField(
              autofocus: true,
              onChanged: (value) => setState(() => query = value),
              decoration: const InputDecoration(
                labelText: 'Country',
                hintText: 'Search your country...',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
            ),
          ),
          Expanded(
            child: ListView.builder(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              itemCount: matches.length,
              itemBuilder: (context, index) {
                final option = matches[index];
                return ListTile(
                  leading:
                      Text(option.flag, style: const TextStyle(fontSize: 24)),
                  title: Text(option.name),
                  trailing: Text(option.code),
                  onTap: () => Navigator.pop(context, option),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
