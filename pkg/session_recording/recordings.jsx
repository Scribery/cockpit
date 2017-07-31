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

    let $ = require("jquery");
    let cockpit = require("cockpit");
    let _ = cockpit.gettext;
    let Journal = require("journal");
    let React = require("react");
    let Listing = require("cockpit-components-listing.jsx");
    let Terminal = require("cockpit-components-terminal.jsx");

    require("bootstrap-datepicker/dist/js/bootstrap-datepicker");

    /*
     * Convert a number to integer number string and pad with zeroes to
     * specified width.
     */
    let padInt = function (n, w) {
        let i = Math.floor(n);
        let a = Math.abs(i);
        let s = a.toString();
        for (w -= s.length; w > 0; w--) {
            s = '0' + s;
        }
        return ((a < 0) ? '-' : '') + s;
    }

    /*
     * Format date and time for a number of milliseconds since Epoch.
     */
    let formatDateTime = function (ms) {
        let d = new Date(ms);
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
    let formatDuration = function (ms) {
        let v = Math.floor(ms / 1000);
        let s = Math.floor(v % 60);
        v = Math.floor(v / 60);
        let m = Math.floor(v % 60);
        v = Math.floor(v / 60);
        let h = Math.floor(v % 24);
        let d = Math.floor(v / 24);
        let str = '';

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
     * A component representing a datepicker based on bootstrap-datepicker.
     * Requires jQuery and bootstrap-datepicker.
     * Properties:
     * - onDateChange: function to call on date change event of datepicker.
     */
    let Datepicker = class extends React.Component {
        constructor(props) {
            super(props);
            this.handleDateChange = this.handleDateChange.bind(this);
        }

        componentDidMount() {
            let funcDate = this.handleDateChange;
            $(this.refs.datepicker).datepicker({
                autoclose: true,
                todayHighlight: true,
                format: 'yyyy-mm-dd',
            }).on('changeDate', function(e) {
                funcDate(e);
            });
        }

        componentWillUnmount() {
            $(this.textInput).datepicker('destroy');
        }

        handleDateChange(e) {
            this.props.onDateChange(e.target.value);
        }

        render() {
            return (
                <input ref="datepicker" className="form-control date" type="text" />
            );
        }
    }

    /*
     * A component representing a username input text field.
     * TODO make as a select / drop-down with list of exisiting users.
    */
    let UserPicker = class extends React.Component {
        constructor(props) {
            super(props);
            this.handleUsernameChange = this.handleUsernameChange.bind(this);
        }

        handleUsernameChange(e) {
            this.props.onUsernameChange(e.target.value);
        }

        render() {
            return (
                <input type="text" className="form-control" onChange={this.handleUsernameChange} />
            );
        }
    }

    /*
     * A component representing a single recording view.
     * Properties:
     * - recording: either null for no recording data available yet, or a
     *              recording object, as created by the View below.
     */
    let Recording = class extends React.Component {
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
            let r = this.props.recording;
            if (!r) {
                return null;
            }
            return cockpit.channel({
                "payload": "stream",
                "spawn": [
                    "/usr/bin/tlog-play",
                    "--follow",
                    "--reader=journal",
                    "-M", "TLOG_REC=" + r.id,
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
                let channel;
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
            let r = this.props.recording;
            if (r == null) {
                return <span>Loading...</span>;
            } else {
                let terminal;

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
                                <td>{_("ID")}</td>
                                <td>{r.id}</td>
                            </tr>
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
    let RecordingList = class extends React.Component {
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
            let columnTitles = [_("User"), _("Start"), _("End"), _("Duration")];
            let list = this.props.list;
            let rows = [];
            for (let i = 0; i < list.length; i++) {
                let r = list[i];
                let columns = [r.user,
                               formatDateTime(r.start),
                               formatDateTime(r.end),
                               formatDuration(r.end - r.start)];
                rows.push(<Listing.ListingRow
                            rowId={r.id}
                            columns={columns}
                            navigateToItem={this.navigateToRecording.bind(this, r)}/>);
            }
            return (
                <div>
                    <div className="content-header-extra">
                        <table className="form-table-ct">
                            <th>
                                <td className="top">
                                    <label className="control-label" for="dateSince">Date Since</label>
                                </td>
                                <td>
                                    <Datepicker onDateChange={this.props.onDateSinceChange} />
                                </td>
                                <td className="top">
                                    <label className="control-label" for="dateUntil">Date Until</label>
                                </td>
                                <td>
                                    <Datepicker onDateChange={this.props.onDateUntilChange} />
                                </td>
                                <td className="top">
                                    <label className="control-label" for="username">Username</label>
                                </td>
                                <td>
                                    <UserPicker onUsernameChange={this.props.onUsernameChange} />
                                </td>
                            </th>
                        </table>
                    </div>
                    <Listing.Listing title={_("Sessions")}
                                     columnTitles={columnTitles}
                                     emptyCaption={_("No recorded sessions")}
                                     fullWidth={false}>
                        {rows}
                    </Listing.Listing>
                </div>
            );
        }
    };

    /*
     * A component representing the view upon a list of recordings, or a
     * single recording. Extracts the ID of the recording to display from
     * cockpit.location.path[0]. If it's zero, displays the list.
     */
    let View = class extends React.Component {
        constructor(props) {
            super(props);
            this.onLocationChanged = this.onLocationChanged.bind(this);
            this.journalctlIngest = this.journalctlIngest.bind(this);
            this.handleDateSinceChange = this.handleDateSinceChange.bind(this);
            this.handleDateUntilChange = this.handleDateUntilChange.bind(this);
            this.handleUsernameChange = this.handleUsernameChange.bind(this);
            /* Journalctl instance */
            this.journalctl = null;
            /* Recording ID journalctl instance is invoked with */
            this.journalctlRecordingID = null;
            /* Recording ID -> data map */
            this.recordingMap = {};
            /* tlog UID in system set in ComponentDidMount */
            this.uid = null;
            this.state = {
                /* List of recordings in start order */
                recordingList: [],
                /* ID of the recording to display, or null for all */
                recordingID: cockpit.location.path[0] || null,
                dateSince: null,
                dateUntil: null,
                /* value to filter recordings by username */
                username: null,
                error_tlog_uid: false,
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
            let recordingList = this.state.recordingList.slice();
            let i;
            let j;

            for (i = 0; i < entryList.length; i++) {
                let e = entryList[i];
                let id = e['TLOG_REC'];

                /* Skip entries with missing recording ID */
                if (id === undefined) {
                    continue;
                }

                let ts = Math.floor(
                            parseInt(e["__REALTIME_TIMESTAMP"], 10) /
                                1000);

                let r = this.recordingMap[id];
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
            let matches = ["_UID=" + this.uid];
            if (this.state.username) {
                matches.push("TLOG_USER=" + this.state.username);
            }
            let options = {follow: true, count: "all", since: this.state.dateSince, until: this.state.dateUntil};

            if (this.state.recordingID !== null) {
                matches.push("TLOG_REC=" + this.state.recordingID);
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

        /*
         * Restarts journalctl.
         * Will stop journalctl if it's running.
         */
        journalctlRestart() {
            if (this.journalctlIsRunning()) {
                this.journalctl.stop();
            }
            this.journalctlStart();
        }

        /*
         * Clears previous recordings list.
         * Will clear service obj recordingMap and state.
         */
        clearRecordings() {
            this.recordingMap = {};
            this.setState({recordingList: []});
        }

        handleDateSinceChange(date) {
            this.setState({dateSince: date});
        }

        handleDateUntilChange(date) {
            this.setState({dateUntil: date});
        }

        handleUsernameChange(username) {
            this.setState({username: username});
        }

        componentDidMount() {
            let proc = cockpit.spawn(["getent", "passwd", "tlog"]);

            proc.stream((data) => {
                this.uid = data.split(":",3)[2];
                this.journalctlStart();
                proc.close();
            });

            proc.fail(() => {
                this.setState({error_tlog_uid: true});
            });

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
            if (this.state.dateSince != prevState.dateSince ||
                this.state.dateUntil != prevState.dateUntil ||
                this.state.username != prevState.username) {
                this.clearRecordings();
                this.journalctlRestart();
            }
        }

        render() {
            if(this.state.error_tlog_uid === true) {
                return (
                    <div className="container-fluid">
                        Error getting tlog uid from system.
                    </div>
                );
            }
            if (this.state.recordingID === null) {
                return (
                    <RecordingList
                        onDateSinceChange={this.handleDateSinceChange}
                        onDateUntilChange={this.handleDateUntilChange}
                        onUsernameChange={this.handleUsernameChange}
                        list={this.state.recordingList} />
                );
            } else {
                return (
                    <Recording recording={this.recordingMap[this.state.recordingID]} />
                );
            }
        }
    };

    React.render(<View />, document.getElementById('view'));
}());
