import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../services/api_service.dart';
import '../../widgets/owner_layout.dart';
import 'owner_portal_common.dart';

class OwnerNewTripScreen extends StatefulWidget {
  const OwnerNewTripScreen({super.key});

  @override
  State<OwnerNewTripScreen> createState() => _OwnerNewTripScreenState();
}

class _OwnerNewTripScreenState extends State<OwnerNewTripScreen> {
  final _api = ApiService.instance;
  List<Map<String, dynamic>> _boats = [];
  List<Map<String, dynamic>> _crew = [];
  final Set<String> _crewIds = {};
  String? _boatId;
  DateTime _departure = DateTime.now().add(const Duration(days: 1));
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final result = await Future.wait([_api.boats(), _api.ownerCrew()]);
      if (!mounted) return;
      setState(() {
        _boats = result[0];
        _crew =
            result[1].where((member) => member['certified'] == true).toList();
        _boatId = _boats.isEmpty ? null : '${_boats.first['id']}';
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = ownerError(error);
        _loading = false;
      });
    }
  }

  Future<void> _pickDeparture() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _departure,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 730)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_departure),
    );
    if (time == null) return;
    setState(() => _departure =
        DateTime(date.year, date.month, date.day, time.hour, time.minute));
  }

  Future<void> _save() async {
    if (_boatId == null) {
      _message('Select a vessel.');
      return;
    }
    if (!_departure.isAfter(DateTime.now())) {
      _message('Scheduled departure must be in the future.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _api.createOwnerTrip(_boatId!, _departure, _crewIds.toList());
      if (!mounted) return;
      _message('Trip scheduled successfully.');
      Navigator.pop(context, true);
    } catch (error) {
      if (mounted) setState(() => _error = ownerError(error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _message(String value) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(value)));

  @override
  Widget build(BuildContext context) => OwnerLayout(
        active: 'trips',
        title: 'Schedule Trip',
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 40),
                  children: [
                    const Text('Schedule New Trip',
                        style: TextStyle(
                            fontSize: 24, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    const Text(
                        'Choose a vessel, departure time, and optional crew assignments.',
                        style: TextStyle(color: ownerMuted)),
                    const SizedBox(height: 22),
                    if (_error != null) ...[
                      OwnerErrorPanel(message: _error!, retry: _load),
                      const SizedBox(height: 16),
                    ],
                    if (_boats.isEmpty)
                      OwnerEmptyPanel(
                        title: 'No vessels available',
                        message: 'Register a vessel before scheduling a trip.',
                        actionLabel: 'Register Boat',
                        onAction: () =>
                            Navigator.pushNamed(context, '/owner_new_boat'),
                      )
                    else ...[
                      OwnerCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _label('Select A Vessel'),
                            DropdownButtonFormField<String>(
                              initialValue: _boatId,
                              isExpanded: true,
                              items: _boats
                                  .map((boat) => DropdownMenuItem(
                                        value: '${boat['id']}',
                                        child: Text(
                                            '${boat['name']} · ${boat['registrationNumber']}'),
                                      ))
                                  .toList(),
                              onChanged: (value) =>
                                  setState(() => _boatId = value),
                            ),
                            const SizedBox(height: 18),
                            _label('Scheduled Departure'),
                            InkWell(
                              onTap: _pickDeparture,
                              child: InputDecorator(
                                decoration: const InputDecoration(
                                    prefixIcon:
                                        Icon(Icons.event_available_outlined)),
                                child: Text(DateFormat('MMM d, y · h:mm a')
                                    .format(_departure)),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      OwnerCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Assign Certified Crew',
                                style: TextStyle(
                                    fontSize: 17, fontWeight: FontWeight.w700)),
                            const SizedBox(height: 5),
                            const Text(
                              'Optional: leave every crew member unchecked to automatically assign all certified crew who are available at the selected date and time.',
                              style: TextStyle(color: ownerMuted, fontSize: 12),
                            ),
                            const SizedBox(height: 12),
                            if (_crew.isEmpty)
                              const Text(
                                  'No certified crew members are in your crew pool. Add them from My Crew first.',
                                  style: TextStyle(color: ownerMuted))
                            else
                              ..._crew.map((member) {
                                final id = '${member['crewUserId']}';
                                return CheckboxListTile(
                                  contentPadding: EdgeInsets.zero,
                                  value: _crewIds.contains(id),
                                  title: Text('${member['name']}',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600)),
                                  subtitle: Text('${member['position']}'),
                                  onChanged: (checked) => setState(() {
                                    checked == true
                                        ? _crewIds.add(id)
                                        : _crewIds.remove(id);
                                  }),
                                );
                              }),
                          ],
                        ),
                      ),
                      const SizedBox(height: 22),
                      FilledButton(
                        onPressed: _saving ? null : _save,
                        child: Text(_saving ? 'Scheduling…' : 'Schedule Trip'),
                      ),
                      TextButton(
                          onPressed:
                              _saving ? null : () => Navigator.pop(context),
                          child: const Text('Cancel')),
                    ],
                  ],
                ),
              ),
      );

  Widget _label(String value) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      );
}
