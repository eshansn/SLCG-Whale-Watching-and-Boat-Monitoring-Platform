import 'dart:async';

import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import '../../services/api_service.dart';
import '../../widgets/owner_layout.dart';
import 'owner_portal_common.dart';

const ownerTransferReasons = [
  'Boat mechanical issue',
  'Boat unavailable',
  'Operational issue',
  'Passenger redistribution',
  'Insufficient passengers',
  'Weather/operational adjustment',
  'Other',
];

class OwnerTripTransferSheet extends StatefulWidget {
  final String sourceTripId;

  const OwnerTripTransferSheet({super.key, required this.sourceTripId});

  @override
  State<OwnerTripTransferSheet> createState() => _OwnerTripTransferSheetState();
}

class _OwnerTripTransferSheetState extends State<OwnerTripTransferSheet> {
  final _api = ApiService.instance;
  final _boatSearch = TextEditingController();
  final _explanation = TextEditingController();
  final Set<String> _passengerIds = {};
  final Set<String> _crewIds = {};
  Map<String, dynamic>? _options;
  Map<String, dynamic>? _destinationBoat;
  Map<String, dynamic>? _destinationTrip;
  List<Map<String, dynamic>> _boats = [];
  List<Map<String, dynamic>> _trips = [];
  String _reason = ownerTransferReasons.first;
  String? _error;
  bool _loading = true;
  bool _searching = false;
  bool _loadingTrips = false;
  bool _saving = false;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _loadOptions();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _boatSearch.dispose();
    _explanation.dispose();
    super.dispose();
  }

  Future<void> _loadOptions() async {
    try {
      final options = await _api.transferOptions(widget.sourceTripId);
      if (!mounted) return;
      setState(() {
        _options = options;
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

  void _searchBoats(String value) {
    _debounce?.cancel();
    final query = value.trim();
    if (query.length < 2) {
      setState(() {
        _boats = [];
        _destinationBoat = null;
        _destinationTrip = null;
        _trips = [];
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      setState(() => _searching = true);
      try {
        final boats =
            await _api.searchTransferBoats(widget.sourceTripId, query);
        if (!mounted) return;
        setState(() {
          _boats = boats;
          _error = null;
          _searching = false;
        });
      } catch (error) {
        if (mounted) {
          setState(() {
            _error = ownerError(error);
            _searching = false;
          });
        }
      }
    });
  }

  Future<void> _selectBoat(Map<String, dynamic> boat) async {
    setState(() {
      _destinationBoat = boat;
      _destinationTrip = null;
      _trips = [];
      _loadingTrips = true;
    });
    try {
      final trips =
          await _api.transferBoatTrips(widget.sourceTripId, '${boat['id']}');
      if (!mounted) return;
      setState(() {
        _trips = trips;
        _loadingTrips = false;
        _error = null;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = ownerError(error);
          _loadingTrips = false;
        });
      }
    }
  }

  bool get _valid {
    return ownerTransferSelectionValid(
      passengerCount: _passengerIds.length,
      crewCount: _crewIds.length,
      destinationTrip: _destinationTrip,
      reason: _reason,
      explanation: _explanation.text,
    );
  }

  @override
  Widget build(BuildContext context) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * .92,
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _options == null
                  ? Padding(
                      padding: const EdgeInsets.all(20),
                      child: OwnerErrorPanel(
                          message: _error ?? 'Unable to load transfer options.',
                          retry: _loadOptions),
                    )
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(20, 18, 20, 40),
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.swap_horiz_rounded,
                                color: ownerNavy),
                            const SizedBox(width: 10),
                            const Expanded(
                              child: Text('Transfer Passengers / Crew',
                                  style: TextStyle(
                                      color: ownerNavy,
                                      fontSize: 20,
                                      fontWeight: FontWeight.w700)),
                            ),
                            IconButton(
                                onPressed: () => Navigator.pop(context),
                                icon: const Icon(Icons.close_rounded)),
                          ],
                        ),
                        const SizedBox(height: 10),
                        _sourceSummary,
                        const SizedBox(height: 16),
                        _peopleSection('Passengers',
                            ownerMaps(_options!['passengers']), _passengerIds),
                        const SizedBox(height: 16),
                        _peopleSection(
                            'Crew', ownerMaps(_options!['crew']), _crewIds),
                        const SizedBox(height: 16),
                        OwnerCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Destination Boat',
                                  style: TextStyle(
                                      fontSize: 17,
                                      fontWeight: FontWeight.w700)),
                              const SizedBox(height: 5),
                              const Text(
                                  'Search approved boats by name or registration number. Boats can belong to another owner.',
                                  style: TextStyle(
                                      color: ownerMuted, fontSize: 12)),
                              const SizedBox(height: 12),
                              TextField(
                                controller: _boatSearch,
                                onChanged: _searchBoats,
                                decoration: const InputDecoration(
                                  hintText: 'Enter at least 2 characters',
                                  prefixIcon: Icon(Icons.search_rounded),
                                ),
                              ),
                              if (_searching)
                                const LinearProgressIndicator(minHeight: 2),
                              ..._boats.map((boat) => RadioListTile<String>(
                                    contentPadding: EdgeInsets.zero,
                                    value: '${boat['id']}',
                                    groupValue: '${_destinationBoat?['id']}',
                                    onChanged: (_) => _selectBoat(boat),
                                    title: Text('${boat['name']}'),
                                    subtitle: Text(
                                        '${boat['registrationNumber']} · ${boat['ownerName']}'),
                                  )),
                              if (_destinationBoat != null) ...[
                                const Divider(height: 26),
                                const Text('Eligible Destination Trip',
                                    style:
                                        TextStyle(fontWeight: FontWeight.w700)),
                                if (_loadingTrips)
                                  const Padding(
                                    padding: EdgeInsets.all(16),
                                    child: Center(
                                        child: CircularProgressIndicator()),
                                  )
                                else if (_trips.isEmpty)
                                  const Padding(
                                    padding: EdgeInsets.only(top: 10),
                                    child: Text(
                                        'This boat has no eligible destination trips.',
                                        style: TextStyle(
                                            color: Color(0xFFB45309))),
                                  )
                                else
                                  ..._trips.map((trip) => RadioListTile<String>(
                                        contentPadding: EdgeInsets.zero,
                                        value: '${trip['id']}',
                                        groupValue:
                                            '${_destinationTrip?['id']}',
                                        onChanged: (_) => setState(
                                            () => _destinationTrip = trip),
                                        title: Text(formatOwnerDate(
                                            trip['scheduledDepartureUtc'])),
                                        subtitle: Text(
                                            '${trip['passengerCount']}/${trip['maximumCapacity']} passengers · ${trip['status']}'),
                                      )),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        OwnerCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Reason',
                                  style:
                                      TextStyle(fontWeight: FontWeight.w700)),
                              const SizedBox(height: 8),
                              DropdownButtonFormField<String>(
                                initialValue: _reason,
                                items: ownerTransferReasons
                                    .map((reason) => DropdownMenuItem(
                                        value: reason, child: Text(reason)))
                                    .toList(),
                                onChanged: (value) =>
                                    setState(() => _reason = value ?? _reason),
                              ),
                              if (_reason == 'Other') ...[
                                const SizedBox(height: 12),
                                TextField(
                                  controller: _explanation,
                                  maxLength: 1000,
                                  maxLines: 4,
                                  onChanged: (_) => setState(() {}),
                                  decoration: const InputDecoration(
                                      labelText: 'Explanation'),
                                ),
                              ],
                            ],
                          ),
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          Text(_error!,
                              style: const TextStyle(color: Colors.red)),
                        ],
                        const SizedBox(height: 18),
                        Text(
                            '${_passengerIds.length} passengers selected · ${_crewIds.length} crew selected',
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: ownerMuted)),
                        const SizedBox(height: 10),
                        FilledButton(
                          onPressed: _valid && !_saving ? _review : null,
                          child: const Text('Review Transfer'),
                        ),
                      ],
                    ),
        ),
      );

  Widget get _sourceSummary {
    final source = ownerMap(_options!['source']);
    return OwnerCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Source Trip',
              style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text('${source['boatName']} · ${source['registrationNumber']}'),
          Text(formatOwnerDate(source['scheduledDepartureUtc']),
              style: const TextStyle(color: ownerMuted)),
        ],
      ),
    );
  }

  Widget _peopleSection(
      String title, List<Map<String, dynamic>> people, Set<String> selected) {
    final allIds = people.map((person) => '${person['id']}').toSet();
    return OwnerCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(title,
                    style: const TextStyle(
                        fontSize: 17, fontWeight: FontWeight.w700)),
              ),
              TextButton(
                onPressed: people.isEmpty
                    ? null
                    : () => setState(() {
                          if (selected.containsAll(allIds)) {
                            selected.clear();
                          } else {
                            selected.addAll(allIds);
                          }
                        }),
                child: Text(selected.containsAll(allIds) && allIds.isNotEmpty
                    ? 'Clear all'
                    : 'Select all'),
              ),
            ],
          ),
          if (people.isEmpty)
            Text('No ${title.toLowerCase()} are available for transfer.',
                style: const TextStyle(color: ownerMuted))
          else
            ...people.map((person) {
              final id = '${person['id']}';
              final subtitle = title == 'Passengers'
                  ? '${person['identificationNumber']}'
                  : '${person['position']} · ${person['email']}';
              return CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: selected.contains(id),
                title: Text('${person['name']}'),
                subtitle: Text(subtitle),
                onChanged: (checked) => setState(() {
                  checked == true ? selected.add(id) : selected.remove(id);
                }),
              );
            }),
        ],
      ),
    );
  }

  Future<void> _review() async {
    final source = ownerMap(_options!['source']);
    final destination = _destinationTrip!;
    final available = ownerTransferAvailableCapacity(destination);
    if (_passengerIds.length > available) {
      setState(() =>
          _error = 'This trip has only $available passenger spaces available.');
      return;
    }
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Confirm transfer'),
            content: Text(
                'You are about to transfer ${_passengerIds.length} passengers and ${_crewIds.length} crew members from ${source['boatName']} to ${destination['boatName']}. Their active trip and boat association will be updated.\n\nReason: $_reason'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Back')),
              FilledButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('Confirm Transfer')),
            ],
          ),
        ) ??
        false;
    if (!confirmed) return;
    await _submit();
  }

  Future<void> _submit() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final result = await _api.transferPeople({
        'clientRequestId': const Uuid().v4(),
        'sourceTripId': widget.sourceTripId,
        'destinationTripId': '${_destinationTrip!['id']}',
        'passengerIds': _passengerIds.toList(),
        'crewUserIds': _crewIds.toList(),
        'reason': _reason,
        if (_reason == 'Other') 'explanation': _explanation.text.trim(),
      });
      if (!mounted) return;
      Navigator.pop(context, result);
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = ownerError(error);
          _saving = false;
        });
      }
    }
  }
}
