/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2017 Red Hat, Inc.
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

(function() {
    "use strict";

    var cockpit = require("cockpit");
    var _ = cockpit.gettext;
    var Journal = require("journal");
    var React = require("react");
    var Listing = require("cockpit-components-listing.jsx");
    var Terminal = require("cockpit-components-terminal.jsx");

    /*
     * Convert a number to integer number string and pad with zeroes to
     * specified width.
     */
    var padInt = function (n, w) {
        var i = Math.floor(n);
        var a = Math.abs(i);
        var s = a.toString();
        for (w -= s.length; w > 0; w--) {
            s = '0' + s;
        }
        return ((a < 0) ? '-' : '') + s;
    }

    /*
     * Format date and time for a number of milliseconds since Epoch.
     */
    var formatDateTime = function (ms) {
        var d = new Date(ms);
        return (
            padInt(d.getFullYear(), 4) + '-' +
            padInt(d.getMonth() + 1, 2) + '-' +
            padInt(d.getDate(), 2) + ' ' +
            padInt(d.getHours(), 2) + ':' +
            padInt(d.getMinutes(), 2) + ':' +
            padInt(d.getSeconds(), 2)
        );
    };

    /*
     * Format a time interval from a number of milliseconds.
     */
    var formatDuration = function (ms) {
        var v = Math.floor(ms / 1000);
        var s = Math.floor(v % 60);
        v = Math.floor(v / 60);
        var m = Math.floor(v % 60);
        v = Math.floor(v / 60);
        var h = Math.floor(v % 24);
        var d = Math.floor(v / 24);
        var str = '';

        if (d > 0) {
            str += d + ' ' + _("days") + ' ';
        }

        if (h > 0 || str.length > 0) {
            str += padInt(h, 2) + ':';
        }

        str += padInt(m, 2) + ':' + padInt(s, 2);

        return (ms < 0 ? '-' : '') + str;
    };

    /*
     * A component representing a single recording view.
     * Properties:
     * - recording: either null for no recording data available yet, or a
     *              recording object, as created by the View below.
     */
    var Recording = class extends React.Component {
        constructor(props) {
            super(props);
            this.state = {
                channel: null,
            };
        }

        /*
         * Create a cockpit channel to a tlog-play instance playing the
         * specified recording. Returns null if there is no recording data.
         */
        createChannel() {
            var r = this.props.recording;
            if (!r) {
                return null;
            }
            return cockpit.channel({
                "payload": "stream",
                "spawn": [
                    "/usr/bin/tlog-play",
                    "--follow",
                    "--reader=journal",
                    "-M", "_BOOT_ID=" + r.boot_id,
                    "-M", "TLOG_SESSION=" + r.session_id,
                    "-M", "_PID=" + r.pid,
                ],
                "environ": [
                    "TERM=xterm-256color",
                    "PATH=/sbin:/bin:/usr/sbin:/usr/bin"
                ],
                "directory": "/",
                "pty": true
            });
        }

        componentDidMount() {
            this.setState({channel: this.createChannel()});
        }

        componentDidUpdate(prevProps) {
            if (this.props.recording != prevProps.recording) {
                var channel;
                if (this.state.channel != null) {
                    this.state.channel.close();
                }
                if (this.props.recording == null) {
                    channel = null;
                } else {
                    channel = this.createChannel();
                }
                this.setState({channel: channel});
            }
        }

        componentWillUnmount() {
            if (this.state.channel != null) {
                this.state.channel.close();
            }
        }

        render() {
            var r = this.props.recording;
            if (r == null) {
                return <span>Loading...</span>;
            } else {
                var terminal;

                if (this.state.channel) {
                    terminal = (<Terminal.Terminal
                                    ref="terminal"
                                    cols={80} rows={24}
                                    channel={this.state.channel} />);
                } else {
                    terminal = <span>Loading...</span>;
                }

                return (
                    <div>
                        <h2>{_("Recording")}</h2>
                        <table>
                            <tr>
                                <td>{_("Boot ID")}</td>
                                <td>{r.boot_id}</td>
                            </tr>
                            <tr>
                                <td>{_("Session ID")}</td>
                                <td>{r.session_id}</td>
                            </tr>
                            <tr>
                                <td>{_("PID")}</td>
                                <td>{r.pid}</td>
                            </tr>
                            <tr>
                                <td>{_("Start")}</td>
                                <td>{formatDateTime(r.start)}</td>
                            </tr>
                            <tr>
                                <td>{_("End")}</td>
                                <td>{formatDateTime(r.end)}</td>
                            </tr>
                            <tr>
                                <td>{_("Duration")}</td>
                                <td>{formatDuration(r.end - r.start)}</td>
                            </tr>
                            <tr>
                                <td>{_("User")}</td>
                                <td>{r.user}</td>
                            </tr>
                        </table>
                        {terminal}
                    </div>
                );
            }
        }
    };

    /*
     * A component representing a list of recordings.
     * Properties:
     * - list: an array with recording objects, as created by the View below
     */
    var RecordingList = class extends React.Component {
        constructor(props) {
            super(props);
        }

        /*
         * Set the cockpit location to point to the specified recording.
         */
        navigateToRecording(recording) {
            cockpit.location.go([recording.id]);
        }

        render() {
            var columnTitles = [_("User"), _("Start"), _("End"), _("Duration")];
            var list = this.props.list;
            var rows = [];
            for (var i = 0; i < list.length; i++) {
                var r = list[i];
                var columns = [r.user,
                               formatDateTime(r.start),
                               formatDateTime(r.end),
                               formatDuration(r.end - r.start)];
                rows.push(<Listing.ListingRow
                            rowId={r.id}
                            columns={columns}
                            navigateToItem={this.navigateToRecording.bind(this, r)}/>);
            }
            return (
                <Listing.Listing title={_("Sessions")}
                                 columnTitles={columnTitles}
                                 emptyCaption={_("No recorded sessions")}
                                 fullWidth={false}>
                    {rows}
                </Listing.Listing>
            );
        }
    };

    /*
     * A component representing the view upon a list of recordings, or a
     * single recording. Extracts the ID of the recording to display from
     * cockpit.location.path[0]. If it's zero, displays the list.
     */
    var View = class extends React.Component {
        constructor(props) {
            super(props);
            this.onLocationChanged = this.onLocationChanged.bind(this);
            this.journalctlIngest = this.journalctlIngest.bind(this);
            /* Journalctl instance */
            this.journalctl = null;
            /* Recording ID journalctl instance is invoked with */
            this.journalctlRecordingID = null;
            /* Recording ID -> data map */
            this.recordingMap = {};
            this.state = {
                /* List of recordings in start order */
                recordingList: [],
                /* ID of the recording to display, or null for all */
                recordingID: cockpit.location.path[0] || null,
            }
        }

        /*
         * Display a journalctl error
         */
        journalctlError(error) {
            console.warn(cockpit.message(error));
        }

        /*
         * Respond to cockpit location change by extracting and setting the
         * displayed recording ID.
         */
        onLocationChanged() {
            this.setState({recordingID: cockpit.location.path[0] || null});
        }

        /*
         * Ingest journal entries sent by journalctl.
         */
        journalctlIngest(entryList) {
            var recordingList = this.state.recordingList.slice();
            var i;
            var j;

            for (i = 0; i < entryList.length; i++) {
                var e = entryList[i];
                var boot_id = e["_BOOT_ID"];
                var session_id = e["TLOG_SESSION"];
                var process_id = e["_PID"];

                /* Skip entries with missing session ID */
                if (session_id === undefined) {
                    continue;
                }

                var id = boot_id + "-" + session_id + "-" + process_id;
                var ts = Math.floor(
                            parseInt(e["__REALTIME_TIMESTAMP"], 10) /
                                1000);

                var r = this.recordingMap[id];
                /* If no recording found */
                if (r === undefined) {
                    /* Create new recording */
                    r = {id:            id,
                         user:          e["TLOG_USER"],
                         boot_id:       e["_BOOT_ID"],
                         session_id:    parseInt(e["TLOG_SESSION"], 10),
                         pid:           parseInt(e["_PID"], 10),
                         start:         ts,
                         /* FIXME Should be start + message duration */
                         end:       ts};
                    /* Map the recording */
                    this.recordingMap[id] = r;
                    /* Insert the recording in order */
                    for (j = recordingList.length - 1;
                         j >= 0 && r.start < recordingList[j].start;
                         j--);
                    recordingList.splice(j + 1, 0, r);
                } else {
                    /* Adjust existing recording */
                    if (ts > r.end) {
                        r.end = ts;
                    }
                    if (ts < r.start) {
                        r.start = ts;
                        /* Find the recording in the list */
                        for (j = recordingList.length - 1;
                             j >= 0 && recordingList[j] != r;
                             j--);
                        /* If found */
                        if (j >= 0) {
                            /* Remove */
                            recordingList.splice(j, 1);
                        }
                        /* Insert the recording in order */
                        for (j = recordingList.length - 1;
                             j >= 0 && r.start < recordingList[j].start;
                             j--);
                        recordingList.splice(j + 1, 0, r);
                    }
                }
            }

            this.setState({recordingList: recordingList});
        }

        /*
         * Start journalctl, retrieving entries for the current recording ID.
         * Assumes journalctl is not running.
         */
        journalctlStart() {
            /* TODO Lookup UID of "tlog" user on module init */
            var matches = ["_UID=987"];
            var options = {follow: true, count: "all"};

            if (this.state.recordingID !== null) {
                var parts = this.state.recordingID.split('-', 3);
                matches = matches.concat([
                            "_BOOT_ID=" + parts[0],
                            "TLOG_SESSION=" + parts[1],
                            "_PID=" + parts[2]
                ]);
            }

            this.journalctlRecordingID = this.state.recordingID;
            this.journalctl = Journal.journalctl(matches, options).
                                        fail(this.journalctlError).
                                        stream(this.journalctlIngest);
        }

        /*
         * Check if journalctl is running.
         */
        journalctlIsRunning() {
            return this.journalctl != null;
        }

        /*
         * Stop current journalctl.
         * Assumes journalctl is running.
         */
        journalctlStop() {
            this.journalctl.stop();
            this.journalctl = null;
        }

        componentDidMount() {
            this.journalctlStart();
            cockpit.addEventListener("locationchanged",
                                     this.onLocationChanged);
        }

        componentWillUnmount() {
            if (this.journalctlIsRunning()) {
                this.journalctlStop();
            }
        }

        componentDidUpdate(prevProps, prevState) {
            /*
             * If we're running a specific (non-wildcard) journalctl
             * and recording ID has changed
             */
            if (this.journalctlRecordingID !== null &&
                this.state.recordingID != prevState.recordingID) {
                if (this.journalctlIsRunning()) {
                    this.journalctlStop();
                }
                this.journalctlStart();
            }
        }

        render() {
            if (this.state.recordingID === null) {
                return <RecordingList list={this.state.recordingList} />;
            } else {
                return (
                    <Recording
                        recording={this.recordingMap[this.state.recordingID]}
                    />
                );
            }
        }
    };

    React.render(<View />, document.getElementById('view'));
}());
