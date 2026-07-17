import 'package:flutter/material.dart';
import '../../owner/owner_store.dart';

class TripRegistrationScreen extends StatefulWidget {
  const TripRegistrationScreen({super.key});
  @override
  State<TripRegistrationScreen> createState() => _TripRegistrationState();
}

class _TripRegistrationState extends State<TripRegistrationScreen> {
  final name = TextEditingController(),
      identity = TextEditingController(),
      phone = TextEditingController(),
      nationality = TextEditingController(),
      emergency = TextEditingController();
  @override
  void dispose() {
    for (final controller in [name, identity, phone, nationality, emergency]) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tripId = ModalRoute.of(context)?.settings.arguments as String?;
    final trip = tripId == null ? null : OwnerStore.instance.trip(tripId);
    if (trip == null)
      return const Scaffold(
          body:
              Center(child: Text('This trip QR code is invalid or expired.')));
    return Scaffold(
        appBar: AppBar(title: Text('Register for ${trip.id}')),
        body: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(children: [
              field(name, 'Full Name'),
              field(identity, 'NIC or Passport'),
              field(phone, 'Phone Number'),
              field(nationality, 'Nationality'),
              field(emergency, 'Emergency Contact'),
              const SizedBox(height: 24),
              SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                      onPressed: () => register(context, trip),
                      child: const Text('Register Passenger')))
            ])));
  }

  void register(BuildContext context, OwnerTrip trip) {
    if ([name, identity, phone, nationality, emergency]
        .any((c) => c.text.trim().isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Complete all passenger details.')));
      return;
    }
    if (trip.passengers.length >= trip.passengerCapacity) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('This trip has reached passenger capacity.')));
      return;
    }
    OwnerStore.instance.registerPassenger(trip.id, OwnerPassenger(
        id: 'passenger-${DateTime.now().millisecondsSinceEpoch}',
        name: name.text.trim(),
        nicOrPassport: identity.text.trim(),
        phone: phone.text.trim(),
        nationality: nationality.text.trim(),
        emergencyContact: emergency.text.trim(),
        registeredAt: DateTime.now()));
    showDialog(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => AlertDialog(
                title: const Text('Registration successful'),
                content: Text('You are registered for ${trip.id}.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.popUntil(
                          dialogContext, (route) => route.isFirst),
                      child: const Text('Done'))
                ]));
  }

  Widget field(TextEditingController controller, String label) => Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextField(
          controller: controller,
          decoration: InputDecoration(
              labelText: label, border: const OutlineInputBorder())));
}
